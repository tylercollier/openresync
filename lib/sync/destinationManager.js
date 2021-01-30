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
} = require('./utils')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const { getIndexes } = require('./indexes')
const xml2js = require('xml2js')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')
const moment = require('moment')

const maxErrorCount = 3

module.exports = function(mlsSourceName, configBundle, eventEmitter) {
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

  const log = console.log
  const catcher = msg => catcherUtil(msg, { destinationManager: this })

  async function resume() {
    const sourceFiles = await getSourceFiles(userConfig, mlsSourceName)
    let processUpsertBatch = _.get(internalConfig, ['sources', mlsSourceName, 'processUpsertBatch'])
    let batchId
    if (processUpsertBatch) {
      const batchTimestamp = moment.utc(processUpsertBatch.batchTimestamp)
      batchId = convertTimestampToBatchId(batchTimestamp)
      // TODO: ensure processUpsertBatch's mlsResourcesStatus matches current config.
    } else {
      batchId = getOldestBatchId(sourceFiles)
      const batchTimestamp = convertBatchIdToTimestamp(batchId)
      processUpsertBatch = {
        batchTimestamp,
        mlsResourcesStatus: userConfig.sources[mlsSourceName].mlsResources.map(mlsResource => ({
          name: mlsResource,
          done: false,
        })),
      }

      // Ensure this batch is not currently being downloaded.
      const downloadUpsertBatch = getBatch(internalConfig, mlsSourceName, 'downloadUpsertBatch')
      if (downloadUpsertBatch) {
        const downloadBatchId = convertTimestampToBatchId(downloadUpsertBatch.batchTimestamp)
        if (batchId === downloadBatchId) {
          throw new Error(`Refusing to process batch ${batchId} because it has not finished downloading`)
        }
      }

      _.set(internalConfig, ['sources', mlsSourceName, 'processUpsertBatch'], processUpsertBatch)
      await flushInternalConfig()
    }
    const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, 'upsert')
    const startIndex = processUpsertBatch.mlsResourcesStatus.findIndex(x => !x.done)
    for (let i = startIndex; i < userConfig.sources[mlsSourceName].mlsResources.length; i++) {
      const mlsResource = userConfig.sources[mlsSourceName].mlsResources[i]
      const filesForMlsResource = sourceFilesForBatch[i]
      const processUpsertBatchMlsResource = processUpsertBatch.mlsResourcesStatus[i]
      if (processUpsertBatchMlsResource.currentFilePath) {
        if (filesForMlsResource.length && processUpsertBatchMlsResource.currentFilePath !== filesForMlsResource[0]) {
          throw new Error(`Existing process batch's currentFilePath (${processUpsertBatchMlsResource.currentFilePath}) doesn't match next file to process (${filesForMlsResource[0]}`)
        }
      }
      for (const filePath of filesForMlsResource) {
        let destinationsStatus
        if (processUpsertBatchMlsResource.currentFilePath) {
          destinationsStatus = processUpsertBatchMlsResource.destinationsStatus
          // TODO: ensure destinationsStatus matches current config.
        } else {
          processUpsertBatchMlsResource.currentFilePath = filePath
          destinationsStatus = destinations.map(destination => ({
            name: destination.name,
            done: false,
            error: null,
            errorCount: 0,
          }))
          processUpsertBatchMlsResource.destinationsStatus = destinationsStatus
          await flushInternalConfig()
        }
        const success = await process({ mlsResource, dataFilePath: filePath, destinationsStatus })
        if (!success) {
          return
        }
        delete processUpsertBatchMlsResource.currentFilePath;
        delete processUpsertBatchMlsResource.destinationsStatus;
        await flushInternalConfig()
      }
      processUpsertBatchMlsResource.done = true
      await flushInternalConfig()
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processUpsertBatch'])
    await flushInternalConfig()
  }

  async function process({ mlsResource, dataFilePath, destinationsStatus }) {
    log(`Start processing MLS resource: ${mlsResource}, data file path: ${dataFilePath}`)
    const fileContents = await fsPromises.readFile(dataFilePath, 'utf8')
    const mlsData = JSON.parse(fileContents)
    const startIndex = destinationsStatus.findIndex(x => !x.done)
    for (let i = startIndex; i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      const destinationStatus = destinationsStatus[i]
      if (destinationStatus.errorCount >= maxErrorCount) {
        log(`Destination ${destinationStatus.name} has reached max error count of ${maxErrorCount}. Refusing to process data file path ${dataFilePath}. Stopping.`)
        return false
      }

      try {
        log(`Syncing data for MLS resource: ${mlsResource}, destination ${destination.name}, data file path ${dataFilePath}`)
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
        log(`Error syncing data: ${JSON.stringify(unpackedError)}`)
        return false
      }
    }
    log(`Done processing MLS resource: ${mlsResource}, data file path: ${dataFilePath}`)
    log(`Deleting data file path: ${dataFilePath}`)
    await fsPromises.unlink(dataFilePath)
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
    resume,
  }
}
