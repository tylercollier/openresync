const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const mysqlDataAdapter = require('./dataAdapters/mysql')
const _ = require('lodash')
const {
  unpackErrorForSerialization,
  getMlsResourceDirFiles,
  getSourceFiles,
  getOldestBatchId,
  getSourceFilesForBatch,
  convertBatchIdToTimestamp,
} = require('./utils')
const fsPromises = require('fs').promises
const pathLib = require('path')
const { getIndexes } = require('./indexes')
const xml2js = require('xml2js')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')

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
    const batchId = getOldestBatchId(sourceFiles)
    const batchTimestamp = convertBatchIdToTimestamp(batchId)
    const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId)
    const processBatch = {
      batchTimestamp,
      mlsResourcesStatus: userConfig.sources[mlsSourceName].mlsResources.map(mlsResource => ({
        name: mlsResource,
        done: false,
      })),
    }
    _.set(internalConfig, ['sources', mlsSourceName, 'processBatch'], processBatch)
    await flushInternalConfig()
    for (let i = 0; i < userConfig.sources[mlsSourceName].mlsResources.length; i++) {
      const mlsResource = userConfig.sources[mlsSourceName].mlsResources[i]
      const filesForMlsResource = sourceFilesForBatch[i]
      const processBatchMlsResource = processBatch.mlsResourcesStatus[i]
      for (const filePath of filesForMlsResource) {
        processBatchMlsResource.currentFilePath = filePath
        const destinationsStatus = destinations.map(destination => ({
          name: destination.name,
          done: false,
          error: null,
          errorCount: 0,
        }))
        processBatchMlsResource.destinationsStatus = destinationsStatus
        await flushInternalConfig()
        const success = await process({ mlsResource, dataFilePath: filePath, destinationsStatus })
        if (!success) {
          return
        }
        delete processBatchMlsResource.currentFilePath;
        delete processBatchMlsResource.destinationsStatus;
        await flushInternalConfig()
      }
      processBatchMlsResource.done = true
      await flushInternalConfig()
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processBatch'])
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

      try {
        log(`Syncing data for MLS resource: ${mlsResource}, destination ${destination.name}, data file path ${dataFilePath}`)
        await dataAdapter.syncData(mlsResource, mlsData.value)
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        destinationsStatus[i].error = unpackedError
        destinationsStatus[i].errorCount++
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
    } else {
      throw new Error('Unknown data adapter: ' + dataAdapterType)
    }
    adapter.setPlatformAdapter(platformAdapter)
    const platformDataAdapter = require(`./platformDataAdapters/${platformAdapterName}/${dataAdapterObj.type}`)()
    adapter.setPlatformDataAdapter(platformDataAdapter)
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
