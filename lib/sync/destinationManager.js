const { buildUserConfig, getInternalConfig, flushInternalConfig, getBatch } = require('../config')
const mysqlDataAdapter = require('./dataAdapters/mysql')
const devnullDataAdapter = require('./dataAdapters/devnull')
const _ = require('lodash')
const {
  unpackErrorForSerialization,
  getMlsResourceDirFiles,
  getSourceFiles,
  getOldestBatchId,
  getSourceFilesForBatch,
  convertBatchIdToTimestamp,
  convertTimestampToBatchId,
  deleteFilesForMlsResource,
  getPrimaryKeyField,
} = require('./utils')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const { getIndexes } = require('./indexes')
const xml2js = require('xml2js')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')
const moment = require('moment')

const maxErrorCount = 3

module.exports = function(mlsSourceName, configBundle, eventEmitter, loggerArg) {
  const logger = loggerArg.child({ source: mlsSourceName })
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const destinations = userConfig.sources[mlsSourceName].destinations
  const platformAdapterName = userConfig.sources[mlsSourceName].platformAdapterName
  let platformAdapter
  if (platformAdapterName === 'bridgeInteractive') {
    platformAdapter = require('./platformAdapters/bridgeInteractive')()
  } else if (platformAdapterName === 'trestle') {
    platformAdapter = require('./platformAdapters/trestle')()
  } else {
    throw new Error('Unknown platform adapter: ' + platformAdapterName)
  }
  const dataAdapters = destinations.map(buildDataAdapter)

  const catcher = msg => catcherUtil(msg, { destinationManager: this, logger })

  async function resumeSync() {
    logger.info('Starting or resuming sync process')
    const sourceFiles = await getSourceFiles(userConfig, mlsSourceName)
    let processSyncBatch = _.get(internalConfig, ['sources', mlsSourceName, 'processSyncBatch'])
    let batchId
    if (processSyncBatch) {
      logger.debug('Found existing process sync batch data')
      const batchTimestamp = moment.utc(processSyncBatch.batchTimestamp)
      batchId = convertTimestampToBatchId(batchTimestamp)
      // TODO: ensure processSyncBatch's mlsResourcesStatus matches current config.
    } else {
      batchId = getOldestBatchId(sourceFiles, 'sync')
      const batchTimestamp = convertBatchIdToTimestamp(batchId)
      processSyncBatch = {
        batchTimestamp,
        mlsResourcesStatus: userConfig.sources[mlsSourceName].mlsResources.map(mlsResource => ({
          name: mlsResource,
          done: false,
        })),
      }

      // Ensure this batch is not currently being downloaded.
      const downloadSyncBatch = getBatch(internalConfig, mlsSourceName, 'downloadSyncBatch')
      if (downloadSyncBatch) {
        const downloadBatchId = convertTimestampToBatchId(downloadSyncBatch.batchTimestamp)
        if (batchId === downloadBatchId) {
          throw new Error(`Refusing to process sync batch ${batchId} because it has not finished downloading`)
        }
      }

      _.set(internalConfig, ['sources', mlsSourceName, 'processSyncBatch'], processSyncBatch)
      await flushInternalConfig()
    }
    logger.debug({ batchTimestamp: processSyncBatch.batchTimestamp, batchId }, 'Timestamp for process sync batch')
    const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, 'sync')
    const startIndex = processSyncBatch.mlsResourcesStatus.findIndex(x => !x.done)
    logger.info('Start processing sync data for resources')
    for (let i = startIndex; i < userConfig.sources[mlsSourceName].mlsResources.length; i++) {
      const mlsResource = userConfig.sources[mlsSourceName].mlsResources[i]
      logger.info({ resource: mlsResource }, 'Start processing sync data for resource')
      const filesForMlsResource = sourceFilesForBatch[i]
      const processSyncBatchMlsResource = processSyncBatch.mlsResourcesStatus[i]
      if (processSyncBatchMlsResource.currentFilePath) {
        if (filesForMlsResource.length && processSyncBatchMlsResource.currentFilePath !== filesForMlsResource[0]) {
          throw new Error(`Existing process batch's currentFilePath (${processSyncBatchMlsResource.currentFilePath}) doesn't match next file to process (${filesForMlsResource[0]}`)
        }
      }
      logger.info({ resource: mlsResource, filesCount: filesForMlsResource.length }, 'Processing sync files')
      for (let i = 0; i < filesForMlsResource.length; i++) {
        const filePath = filesForMlsResource[i]
        logger.info({ resource: mlsResource, fileNum: i + 1, dataFilePath: filePath }, 'Processing sync file')
        let destinationsStatus
        if (processSyncBatchMlsResource.currentFilePath) {
          destinationsStatus = processSyncBatchMlsResource.destinationsStatus
          // TODO: ensure destinationsStatus matches current config.
        } else {
          processSyncBatchMlsResource.currentFilePath = filePath
          destinationsStatus = destinations.map(destination => ({
            name: destination.name,
            done: false,
            error: null,
            errorCount: 0,
          }))
          processSyncBatchMlsResource.destinationsStatus = destinationsStatus
          await flushInternalConfig()
        }
        const success = await processSync({ mlsResource, dataFilePath: filePath, destinationsStatus })
        if (!success) {
          return
        }
        delete processSyncBatchMlsResource.currentFilePath;
        delete processSyncBatchMlsResource.destinationsStatus;
        await flushInternalConfig()
      }
      processSyncBatchMlsResource.done = true
      await flushInternalConfig()
      logger.info({ resource: mlsResource }, 'Done processing sync data for resource')
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processSyncBatch'])
    await flushInternalConfig()
    logger.info('Done processing sync data for resources')
  }

  async function processSync({ mlsResource, dataFilePath, destinationsStatus }) {
    const fileContents = await fsPromises.readFile(dataFilePath, 'utf8')
    const mlsData = JSON.parse(fileContents)
    const startIndex = destinationsStatus.findIndex(x => !x.done)
    for (let i = startIndex; i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      const destinationStatus = destinationsStatus[i]
      if (destinationStatus.errorCount >= maxErrorCount) {
        logger.warn({ resource: mlsResource, dataFilePath, destination: destination.name }, `Destination has reached max error count of ${maxErrorCount}. Refusing to process sync.`)
        return false
      }

      try {
        logger.info({ resource: mlsResource, dataFilePath, destination: destination.name }, 'Syncing to destination')
        if ('debug' !== 'debug' && destination.name === 'devnull1' && pathLib.basename(dataFilePath) === 'batch_2021-01-24-T-20-24-33-941Z_seq_2021-01-24-T-20-30-23-714Z.json') {
          throw new Error('test error')
        }
        await dataAdapter.syncData(mlsResource, mlsData.value)
        destinationStatus.done = true
        await flushInternalConfig()
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        destinationStatus.error = unpackedError
        destinationStatus.errorCount++
        await flushInternalConfig()
        logger.error({ err: e }, 'Error syncing')
        return false
      }
    }
    logger.info({ resource: mlsResource, dataFilePath }, 'Done syncing file data')
    logger.info({ resource: mlsResource, dataFilePath }, 'Deleting sync file')
    await fsPromises.unlink(dataFilePath)
    return true
  }

  async function resumePurge() {
    logger.info('Starting or resuming purge')
    const sourceFiles = await getSourceFiles(userConfig, mlsSourceName)
    let processPurgeBatch = _.get(internalConfig, ['sources', mlsSourceName, 'processPurgeBatch'])
    let batchId
    if (processPurgeBatch) {
      logger.debug('Found existing process purge batch data')
      const batchTimestamp = moment.utc(processPurgeBatch.batchTimestamp)
      batchId = convertTimestampToBatchId(batchTimestamp)
      // TODO: ensure processPurgeBatch's mlsResourcesStatus matches current config.
    } else {
      batchId = getOldestBatchId(sourceFiles, 'purge')
      const batchTimestamp = convertBatchIdToTimestamp(batchId)
      const destinationsStatus = destinations.map(destination => ({
        name: destination.name,
        done: false,
        error: null,
        errorCount: 0,
      }))
      processPurgeBatch = {
        batchTimestamp,
        mlsResourcesStatus: userConfig.sources[mlsSourceName].mlsResources.map(mlsResource => ({
          name: mlsResource,
          done: false,
          // Don't use a single reference. Copy the destinationsStatus for each MLS resource.
          destinationsStatus: _.cloneDeep(destinationsStatus),
        })),
      }

      // Ensure this batch is not currently being downloaded.
      const downloadPurgeBatch = getBatch(internalConfig, mlsSourceName, 'downloadPurgeBatch')
      if (downloadPurgeBatch) {
        const downloadBatchId = convertTimestampToBatchId(downloadPurgeBatch.batchTimestamp)
        if (batchId === downloadBatchId) {
          throw new Error(`Refusing to process purge batch ${batchId} because it has not finished downloading`)
        }
      }

      _.set(internalConfig, ['sources', mlsSourceName, 'processPurgeBatch'], processPurgeBatch)
      await flushInternalConfig()
    }

    logger.debug({ batchTimestamp: processPurgeBatch.batchTimestamp, batchId }, 'Timestamp for process purge batch')
    const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, 'purge')
    const startIndex = processPurgeBatch.mlsResourcesStatus.findIndex(x => !x.done)
    logger.info('Start processing purge data for resources')
    for (let i = startIndex; i < userConfig.sources[mlsSourceName].mlsResources.length; i++) {
      const mlsResource = userConfig.sources[mlsSourceName].mlsResources[i]
      logger.info({ resource: mlsResource }, 'Start processing purge data for resource')
      const filesForMlsResource = sourceFilesForBatch[i]
      const processPurgeBatchMlsResource = processPurgeBatch.mlsResourcesStatus[i]
      const destinationsStatus = processPurgeBatchMlsResource.destinationsStatus
      const mlsIndexes = getIndexes(mlsResource)
      const primaryKey = getPrimaryKeyField(mlsResource, mlsIndexes)

      // We can't process the files one by one, like with sync. Instead, we concat all the data
      // and compare it to what's in the destinations.
      logger.info({ resource: mlsResource }, 'Reading IDs from MLS')
      let idsInMls = []
      for (const filePath of filesForMlsResource) {
        const fileContents = await fsPromises.readFile(filePath, 'utf8')
        const mlsData = JSON.parse(fileContents)
        const ids = mlsData.value.map(x => x[primaryKey])
        idsInMls = idsInMls.concat(ids)
      }
      if (!userConfig.sources[mlsSourceName].useOrderBy) {
        idsInMls.sort()
      }
      const success = await processPurge({ mlsResource, idsInMls, destinationsStatus, mlsIndexes })
      if (!success) {
        return
      }
      delete processPurgeBatchMlsResource.destinationsStatus
      processPurgeBatchMlsResource.done = true
      await flushInternalConfig()

      logger.info({ resource: mlsResource }, 'Done processing purge for resource')
      logger.info({ resource: mlsResource }, 'Deleting purge files')
      await deleteFilesForMlsResource(filesForMlsResource, logger.child({ resource: mlsResource }))
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processPurgeBatch'])
    await flushInternalConfig()
    logger.info('Done processing purge data for resources')
  }

  async function processPurge({ mlsResource, idsInMls, destinationsStatus, mlsIndexes }) {
    logger.info({ resource: mlsResource }, 'Starting to purge resource')
    const startIndex = destinationsStatus.findIndex(x => !x.done)
    for (let i = startIndex; i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      const destinationStatus = destinationsStatus[i]
      if (destinationStatus.errorCount >= maxErrorCount) {
        logger.warn({ resource: mlsResource, destination: destination.name }, `Destination has reached max error count of ${maxErrorCount}. Refusing to process purge.`)
        return false
      }

      try {
        logger.info({ resource: mlsResource, destination: destination.name }, 'Getting existing IDs from destination')
        const idsInDestination = await dataAdapter.getAllIds(mlsResource, mlsIndexes)
        const idsToPurge = _.difference(idsInDestination, idsInMls)
        if (idsToPurge.length) {
          logger.info({ resource: mlsResource, destination: destination.name }, 'Purging data')
          await dataAdapter.purge(mlsResource, idsToPurge, mlsIndexes)
        } else {
          if ('debug' !== 'debug' && mlsResource === 'Member' && destination.name === 'devnull1') {
            throw new Error('error to test stopping mid purge')
          }
          logger.info({ resource: mlsResource, destination: destination.name }, 'No IDs to purge')
        }
        destinationStatus.done = true
        await flushInternalConfig()
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        destinationStatus.error = unpackedError
        destinationStatus.errorCount++
        await flushInternalConfig()
        logger.error({ err: e }, 'Error purging')
        return false
      }
    }
    logger.info({ resource: mlsResource }, 'Done purging')
    return true
  }

  function buildDataAdapter(dataAdapterObj) {
    const dataAdapterType = dataAdapterObj.type
    let adapter
    if (dataAdapterType === 'mysql') {
      adapter = mysqlDataAdapter(userConfig, mlsSourceName, dataAdapterObj.config)
    } else if (dataAdapterType === 'devnull') {
      adapter = devnullDataAdapter(userConfig, mlsSourceName, dataAdapterObj.config)
    } else {
      throw new Error('Unknown data adapter: ' + dataAdapterType)
    }
    adapter.setPlatformAdapter(platformAdapter)
    const platformDataAdapterPath = `./platformDataAdapters/${platformAdapterName}/${dataAdapterObj.type}`
    let platformDataAdapter
    try {
      platformDataAdapter = require(platformDataAdapterPath)()
      adapter.setPlatformDataAdapter(platformDataAdapter)
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
    return adapter
  }

  // Initially, the primary data adapter is used to get the timestamps. Theoretically, all data adapters should agree
  // on the value(s), so really the term 'primary' here just means to consistently refer to one of the data adapters
  // used. Might as well use the first one.
  function getPrimaryDataAdapter() {
    return dataAdapters[0]
  }

  function closeConnections() {
    return Promise.all(dataAdapters.map(x => x.closeConnection()))
  }

  async function syncMetadata(metadataString) {
    const parser = new xml2js.Parser()
    const metadata = await parser.parseStringPromise(metadataString)
      .catch(catcher('parse metadata'))
    const mlsResources = userConfig.sources[mlsSourceName].mlsResources
    await Promise.all(_.flatMap(mlsResources, mlsResource => {
      const indexes = getIndexes(mlsResource)
      return dataAdapters.map(dataAdapter => {
        return dataAdapter.syncStructure(metadata, mlsResource, indexes)
      })
    }))
  }

  return {
    getPrimaryDataAdapter,
    closeConnections,
    syncMetadata,
    resumeSync,
    resumePurge,
  }
}
