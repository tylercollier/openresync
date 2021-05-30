const {
  buildUserConfig,
  getInternalConfig,
  flushInternalConfig,
  getBatch,
  getMlsSourceUserConfig,
  getMlsSourceInternalConfig
} = require('../config')
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
  flattenExpandedMlsResources,
} = require('./utils')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const { getIndexes } = require('./indexes')
const xml2js = require('xml2js')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')
const moment = require('moment')
const { buildDataAdapter } = require('./dataAdapters/index')

const maxErrorCount = 3

module.exports = function(mlsSourceName, configBundle, eventEmitter, loggerArg) {
  const logger = loggerArg.child({ source: mlsSourceName })
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const mlsSourceUserConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
  const mlsSourceInternalConfig = getMlsSourceInternalConfig(internalConfig, mlsSourceName)
  const destinations = mlsSourceUserConfig.destinations
  const platformAdapterName = mlsSourceUserConfig.platformAdapterName
  const dataAdapters = destinations.map(destination => buildDataAdapter({
    destinationConfig: destination,
    platformAdapterName,
  }))

  const catcher = msg => catcherUtil(msg, { destinationManager: this, logger })

  async function resumeSync(batchType) {
    try {
      logger.info('Starting or resuming sync process')
      const mlsResources = mlsSourceUserConfig.mlsResources
      const sourceFiles = await getSourceFiles(mlsSourceName, mlsResources)
      let processSyncBatch = _.get(mlsSourceInternalConfig, ['processSyncBatch'])
      let batchId
      if (processSyncBatch) {
        logger.debug('Found existing process sync batch data')
        const batchTimestamp = moment.utc(processSyncBatch.batchTimestamp)
        batchId = convertTimestampToBatchId(batchTimestamp)
        // TODO: ensure processSyncBatch's mlsResourcesStatus matches current config.
      } else {
        batchId = getOldestBatchId(sourceFiles, batchType)
        if (!batchId) {
          logger.info('Found no sync files to process. Done.')
          return
        }
        const batchTimestamp = convertBatchIdToTimestamp(batchId)
        processSyncBatch = {
          batchTimestamp,
          mlsResourcesStatus: mlsResources.map(mlsResourceObj => ({
            name: mlsResourceObj.name,
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

        _.set(mlsSourceInternalConfig, ['processSyncBatch'], processSyncBatch)
        await flushInternalConfig()
      }
      logger.debug({ batchTimestamp: processSyncBatch.batchTimestamp, batchId }, 'Timestamp for process sync batch')
      const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, batchType)
      eventEmitter.emit('ors:sync.start', {
        mlsSourceName,
        batchId,
      })
      const startIndex = processSyncBatch.mlsResourcesStatus.findIndex(x => !x.done)
      logger.info('Start processing sync data for resources')
      for (let i = startIndex; i < mlsResources.length; i++) {
        const mlsResourceObj = mlsResources[i]
        const mlsResourceName = mlsResourceObj.name
        logger.info({resource: mlsResourceName}, 'Start processing sync data for resource')
        eventEmitter.emit('ors:sync.resource.start', {mlsResourceObj})
        const filesForMlsResource = sourceFilesForBatch[i]
        const processSyncBatchMlsResource = processSyncBatch.mlsResourcesStatus[i]
        if (processSyncBatchMlsResource.currentFilePath) {
          if (filesForMlsResource.length && processSyncBatchMlsResource.currentFilePath !== filesForMlsResource[0]) {
            throw new Error(`Existing process batch's currentFilePath (${processSyncBatchMlsResource.currentFilePath}) doesn't match next file to process (${filesForMlsResource[0]}`)
          }
        }
        logger.info({resource: mlsResourceName, filesCount: filesForMlsResource.length}, 'Processing sync files')
        for (let i = 0; i < filesForMlsResource.length; i++) {
          const filePath = filesForMlsResource[i]
          const fileNum = i + 1
          logger.info({resource: mlsResourceName, fileNum, dataFilePath: filePath}, 'Processing sync file')
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
          const success = await processSync({
            mlsResourceObj,
            dataFilePath: filePath,
            destinationsStatus,
            fileNum,
            fileCount: filesForMlsResource.length,
            eventEmitter,
          })
          if (!success) {
            return
          }
          delete processSyncBatchMlsResource.currentFilePath;
          delete processSyncBatchMlsResource.destinationsStatus;
          await flushInternalConfig()
        }
        processSyncBatchMlsResource.done = true
        await flushInternalConfig()
        eventEmitter.emit('ors:sync.resource.done', {mlsResourceObj})
        logger.info({resource: mlsResourceName}, 'Done processing sync data for resource')
      }
      _.unset(mlsSourceInternalConfig, ['processSyncBatch'])
      await flushInternalConfig()
      eventEmitter.emit('ors:sync.done', { mlsSourceName, batchId })
      logger.info('Done processing sync data for resources')
    } catch (error) {
      eventEmitter.emit('ors:sync.error', error)
      throw error
    }
  }

  async function processSync({ mlsResourceObj, dataFilePath, destinationsStatus, fileNum, fileCount, eventEmitter }) {
    const mlsResourceName = mlsResourceObj.name
    const fileContents = await fsPromises.readFile(dataFilePath, 'utf8')
    const mlsData = JSON.parse(fileContents)
    const startIndex = destinationsStatus.findIndex(x => !x.done)
    for (let i = startIndex; i >= 0 && i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      const destinationStatus = destinationsStatus[i]
      if (destinationStatus.errorCount >= maxErrorCount) {
        logger.warn({ resource: mlsResourceName, dataFilePath, destination: destination.name }, `Destination has reached max error count of ${maxErrorCount}. Refusing to process sync.`)
        return false
      }

      try {
        const recordsToSyncCount = (mlsData.value && mlsData.value.length) || 0
        let existingRecordsInDestinationCount
        if (fileNum === 1) {
          existingRecordsInDestinationCount = await dataAdapter.getCount(mlsResourceName)
          logger.debug({ resource: mlsResourceName, destination: destination.name, recordsCount: existingRecordsInDestinationCount }, 'Starting with X records in destination')
        }
        if (recordsToSyncCount > 0) {
          logger.info({
            resource: mlsResourceName,
            dataFilePath,
            destination: destination.name,
            recordsToSyncCount
          }, 'Syncing X records to destination')
          if ('debug' !== 'debug' && destination.name === 'devnull1' && pathLib.basename(dataFilePath) === 'batch_2021-01-24-T-20-24-33-941Z_seq_2021-01-24-T-20-30-23-714Z.json') {
            throw new Error('test error')
          }
          await dataAdapter.syncData(mlsResourceObj, mlsData.value)
        } else {
          logger.info({ resource: mlsResourceName, destination: destination.name }, 'File had 0 records. Skipping sync.')
        }
        destinationStatus.done = true
        await flushInternalConfig()
        eventEmitter.emit('ors:sync.destination.page', { destination, recordsSyncedCount: recordsToSyncCount })
        if (fileNum === fileCount) {
          const recordsInDestinationCount = await dataAdapter.getCount(mlsResourceName)
          logger.debug({ resource: mlsResourceName, destination: destination.name, recordsCount: recordsInDestinationCount }, 'Ended with X records in destination')
        }
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        destinationStatus.error = unpackedError
        destinationStatus.errorCount++
        await flushInternalConfig()
        logger.error({ err: e }, 'Error syncing')
        return false
      }
    }
    logger.info({ resource: mlsResourceName, dataFilePath }, 'Done syncing file data')
    logger.info({ resource: mlsResourceName, dataFilePath }, 'Deleting sync file')
    await fsPromises.unlink(dataFilePath)
    return true
  }

  async function resumePurge() {
    try {
      logger.info('Starting or resuming purge')
      const topLevelMlsResources = mlsSourceUserConfig.mlsResources
      const mlsResources = flattenExpandedMlsResources(topLevelMlsResources)
      const sourceFiles = await getSourceFiles(mlsSourceName, mlsResources)
      let processPurgeBatch = _.get(mlsSourceInternalConfig, ['processPurgeBatch'])
      let batchId
      if (processPurgeBatch) {
        logger.debug('Found existing process purge batch data')
        const batchTimestamp = moment.utc(processPurgeBatch.batchTimestamp)
        batchId = convertTimestampToBatchId(batchTimestamp)
        // TODO: ensure processPurgeBatch's mlsResourcesStatus matches current config.
      } else {
        batchId = getOldestBatchId(sourceFiles, 'purge')
        if (!batchId) {
          logger.info('Found no purge files to process. Done.')
          return
        }
        const batchTimestamp = convertBatchIdToTimestamp(batchId)
        const destinationsStatus = destinations.map(destination => ({
          name: destination.name,
          done: false,
          error: null,
          errorCount: 0,
        }))
        processPurgeBatch = {
          batchTimestamp,
          mlsResourcesStatus: mlsResources.map(mlsResourceObj => ({
            name: mlsResourceObj.name,
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

        _.set(mlsSourceInternalConfig, ['processPurgeBatch'], processPurgeBatch)
        await flushInternalConfig()
      }

      logger.debug({ batchTimestamp: processPurgeBatch.batchTimestamp, batchId }, 'Timestamp for process purge batch')
      const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, 'purge')
      eventEmitter.emit('ors:purge.start', {
        mlsSourceName,
        batchId,
      })
      const startIndex = processPurgeBatch.mlsResourcesStatus.findIndex(x => !x.done)
      logger.info('Start processing purge data for resources')
      for (let i = startIndex; i < mlsResources.length; i++) {
        const mlsResourceObj = mlsResources[i]
        const mlsResourceName = mlsResources[i].name
        logger.info({ resource: mlsResourceName }, 'Start processing purge data for resource')
        eventEmitter.emit('ors:purge.resource.start', {mlsResourceObj})
        const filesForMlsResource = sourceFilesForBatch[i]
        const processPurgeBatchMlsResource = processPurgeBatch.mlsResourcesStatus[i]
        const destinationsStatus = processPurgeBatchMlsResource.destinationsStatus
        const mlsIndexes = getIndexes(mlsResourceName)
        const primaryKey = getPrimaryKeyField(mlsResourceName, mlsIndexes)

        // We can't process the files one by one, like with sync. Instead, we concat all the data
        // and compare it to what's in the destinations.
        logger.info({ resource: mlsResourceName }, 'Reading IDs from MLS')
        let idsInMls = []
        for (const filePath of filesForMlsResource) {
          logger.trace({ resource: mlsResourceName, dataFilePath: filePath }, 'Reading IDs from data file path')
          const fileContents = await fsPromises.readFile(filePath, 'utf8')
          const mlsData = JSON.parse(fileContents)
          const ids = mlsData.value.map(x => x[primaryKey])
          idsInMls = idsInMls.concat(ids)
        }
        logger.trace({ resource: mlsResourceName }, 'Sorting IDs')
        if (!mlsSourceUserConfig.useOrderBy) {
          idsInMls.sort()
        }
        const success = await processPurge({ mlsResourceName, idsInMls, destinationsStatus, mlsIndexes })
        if (!success) {
          return
        }
        delete processPurgeBatchMlsResource.destinationsStatus
        processPurgeBatchMlsResource.done = true
        await flushInternalConfig()

        logger.info({ resource: mlsResourceName }, 'Done processing purge for resource')
        logger.info({ resource: mlsResourceName }, 'Deleting purge files')
        eventEmitter.emit('ors:purge.resource.done', {mlsResourceObj})
        await deleteFilesForMlsResource(filesForMlsResource, logger.child({ resource: mlsResourceName }))
      }
      _.unset(mlsSourceInternalConfig, ['processPurgeBatch'])
      await flushInternalConfig()
      eventEmitter.emit('ors:purge.done', { mlsSourceName, batchId })
      logger.info('Done processing purge data for resources')
    } catch (error) {
      eventEmitter.emit('ors:purge.error', error)
      throw error
    }
  }

  async function processPurge({ mlsResourceName, idsInMls, destinationsStatus, mlsIndexes }) {
    logger.info({ resource: mlsResourceName }, 'Starting to purge resource')
    const startIndex = destinationsStatus.findIndex(x => !x.done)
    for (let i = startIndex; i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      const destinationStatus = destinationsStatus[i]
      if (destinationStatus.errorCount >= maxErrorCount) {
        logger.warn({ resource: mlsResourceName, destination: destination.name }, `Destination has reached max error count of ${maxErrorCount}. Refusing to process purge.`)
        return false
      }

      try {
        logger.info({ resource: mlsResourceName, destination: destination.name }, 'Getting existing IDs from destination')
        const idsInDestination = await dataAdapter.getAllIds(mlsResourceName, mlsIndexes)
        const idsToPurge = _.difference(idsInDestination, idsInMls)
        if (idsToPurge.length) {
          logger.info({ resource: mlsResourceName, destination: destination.name, recordsCount: idsToPurge.length }, 'Purging X records')
          await dataAdapter.purge(mlsResourceName, idsToPurge, mlsIndexes)
          logger.debug({ resource: mlsResourceName, destination: destination.name, recordsCount: idsInDestination.length - idsToPurge.length }, 'Successfully purged records. Net is X records.')
        } else {
          if ('debug' !== 'debug' && mlsResourceName === 'Member' && destination.name === 'devnull1') {
            throw new Error('error to test stopping mid purge')
          }
          logger.info({ resource: mlsResourceName, destination: destination.name }, 'No IDs to purge')
        }
        destinationStatus.done = true
        await flushInternalConfig()
        eventEmitter.emit('ors:purge.destination.page', { destination, idsPurged: idsToPurge })
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        destinationStatus.error = unpackedError
        destinationStatus.errorCount++
        await flushInternalConfig()
        logger.error({ err: e }, 'Error purging')
        return false
      }
    }
    logger.info({ resource: mlsResourceName }, 'Done purging')
    return true
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
    const mlsResources = mlsSourceUserConfig.mlsResources
    await Promise.all(_.flatMap(mlsResources, mlsResourceObj => {
      return dataAdapters.map(dataAdapter => {
        return dataAdapter.syncStructure(mlsResourceObj, metadata)
      })
    }))
  }

  async function getStatsDetails() {
    const mlsResources = mlsSourceUserConfig.mlsResources
    const d = await Promise.all(mlsResources.map(async resource => {
      const destinationData = await Promise.all(destinations.map(async (destination, i) => {
        const dataAdapter = dataAdapters[i]
        const [existingRecordsInDestinationCount, mostRecentAt] = await Promise.all([
          dataAdapter.getCount(resource.name),
          dataAdapter.getMostRecentTimestamp(resource.name),
        ])
        return {
          name: destination.name,
          num_records: existingRecordsInDestinationCount,
          most_recent_at: mostRecentAt,
        }
      }))
      return {
        name: resource.name,
        destinations: destinationData,
      }
    }))
    return d
  }

  async function getMissingIds(mlsResourceName, dataInMls, indexes) {
    let allMissingIds = []
    for (let i = 0; i < destinations.length; i++) {
      const destination = destinations[i]
      logger.trace({ resource: mlsResourceName, destination: destination.name }, 'Getting missing IDs from destination for resource')

      const dataAdapter = dataAdapters[i]
      const missingIdsForDestination = await dataAdapter.getMissingIds(mlsResourceName, dataInMls, indexes)
      allMissingIds = allMissingIds.concat(missingIdsForDestination)
      if (i !== 0) {
        // I'm doing uniq() each time with the thought of reducing memory use.
        allMissingIds = _.uniq(allMissingIds)
      }
    }
    return allMissingIds
  }

  return {
    getPrimaryDataAdapter,
    closeConnections,
    syncMetadata,
    resumeSync,
    resumePurge,
    getStatsDetails,
    getMissingIds,
  }
}
