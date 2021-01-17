const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const mysqlDataAdapter = require('./dataAdapters/mysql')
const _ = require('lodash')
const { unpackErrorForSerialization } = require('./utils')
const fsPromises = require('fs').promises
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
  let isProcessing = dataAdapters.map(x => false)
  const queue = []

  const log = console.log
  const catcher = msg => catcherUtil(msg, { destinationManager: this })

  eventEmitter.on('downloaded', ({ mlsResource, dataFilePath, mlsData }) => {
    // Reminder: I think we need to process each data set (JSON file) for all data adapters before moving on to the
    // next data set (JSON file). That way, the different databases will be (more) in sync.
    //
    // Otherwise, what if we process all files for data adapter 1, and then before we're done processing for data
    // adapter 2, more comes in for adapter 1? That's a starvation situation where adapter 1 will never catch up
    // if the pattern continues. Although, if that really happens, I suppose that indicates that the data processing
    // is slower than the downloading, and theoretically indicates a problem in processing (like bad RBDMS indexes).
    // Such a situation should not happen except in rare circumstances like where the MLS does a large batch update.
    maybeProcess({ mlsResource, dataFilePath, mlsData })
  })

  function maybeProcess({ mlsResource, dataFilePath, mlsData }) {
    if (!_.some(isProcessing, _.identity)) {
      let processBatch = getOrBuildProcessBatch(dataFilePath)
      if (processBatch) {
        // TODO: somehow we need to ensure the destinations are still the same.

        if (processBatch.dataFilePath === dataFilePath) {
          if (processBatch.errorCount < maxErrorCount) {
            process({ mlsResource, dataFilePath, mlsData, processBatch })
              .then(async () => {
                while (queue.length) {
                  const pop = queue.pop()
                  dataFilePath = pop.dataFilePath
                  processBatch = getOrBuildProcessBatch(dataFilePath)
                  await process({ mlsResource, dataFilePath, processBatch })
                }
              })
          }
        } else {
          log(`Not processing data file path: ${dataFilePath} because it doesn't match existing process batch data file path: ${processBatch.dataFilePath}`)
        }
      }
    } else {
      queue.push({ mlsResource, dataFilePath })
      log(`Not processing MLS resource: ${mlsResource}, data file path: ${dataFilePath}, busy`)
    }
  }

  function getOrBuildProcessBatch(dataFilePath) {
    const processBatch = _.get(internalConfig, ['sources', mlsSourceName, 'processBatch'])
    if (processBatch) {
      // FIXME: Ew. Don't have this side effect in here.
      isProcessing = processBatch.isProcessing
      return processBatch
    }
    return {
      dataFilePath,
      // FIXME: I don't like this non-pure value used like this.
      isProcessing,
      error: null,
      errorCount: 0,
    }
  }

  async function process({ mlsResource, dataFilePath, mlsData, processBatch }) {
    log(`Start processing MLS resource: ${mlsResource}, data file path: ${dataFilePath}`)
    const data = mlsData || await fsPromises.readFile(dataFilePath, 'utf8')
    const startIndex = isProcessing.indexOf(true) === -1 ? 0 : isProcessing.indexOf(true)
    for (let i = startIndex; i < destinations.length; i++) {
      const destination = destinations[i]
      const dataAdapter = dataAdapters[i]
      isProcessing[i] = true

      _.set(internalConfig, ['sources', mlsSourceName, 'processBatch'], processBatch)
      await flushInternalConfig()

      try {
        log(`Syncing data for MLS resource: ${mlsResource}, destination ${destination.name}, data file path ${dataFilePath}`)
        await dataAdapter.syncData(mlsResource, data.value)
      } catch (e) {
        const unpackedError = unpackErrorForSerialization(e)
        processBatch.error = unpackedError
        processBatch.errorCount++
        _.set(internalConfig, ['sources', mlsSourceName, 'processBatch'], processBatch)
        await flushInternalConfig()
        log(`Error syncing data: ${JSON.stringify(unpackedError)}`)
        return
      }
      isProcessing[i] = false
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processBatch'])
    await flushInternalConfig()
    log(`Done processing MLS resource: ${mlsResource}, data file path: ${dataFilePath}`)
    log(`Deleting data file path: ${dataFilePath}`)
    await fsPromises.unlink(dataFilePath)
  }

  function buildDataAdapter(dataAdapterObj) {
    const dataAdapterType = dataAdapterObj.type
    if (dataAdapterType === 'mysql') {
      const adapter = mysqlDataAdapter(userConfig, mlsSourceName, dataAdapterObj.config)
      adapter.setPlatformAdapter(platformAdapter)
      const platformDataAdapter = require(`./platformDataAdapters/${platformAdapterName}/${dataAdapterObj.type}`)()
      adapter.setPlatformDataAdapter(platformDataAdapter)
      return adapter
    } else {
      throw new Error('Unknown data adapter: ' + dataAdapterType)
    }
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
  }
}
