const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const mysqlDataAdapter = require('./dataAdapters/mysql')
const _ = require('lodash')
const { serializeError } = require('./utils')
const fsPromises = require('fs').promises

// let mlsResources = userConfig.sources[mlsSourceName].mlsResources
//
// for (const mlsResource of mlsResources) {
//   const indexes = getIndexes(mlsResource)
//   await dataAdapter.syncStructure(metadata, mlsResource, indexes)
//     .catch(catcher('sync structure'))
// }

const maxErrorCount = 3

module.exports = function(mlsSourceName, configBundle, eventEmitter) {
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const dataAdapters = userConfig.sources[mlsSourceName].destinations.map(buildDataAdapter)
  let isProcessing = dataAdapters.map(x => false)
  const queue = []

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

  function maybeProcess({ mslResource, dataFilePath, mlsData }) {
    if (!_.any(isProcessing, _.identity)) {
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
        }
      }
    } else {
      queue.push({ mlsResource, dataFilePath })
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
    const data = mlsData || await fsPromises.readFile(dataFilePath, 'utf8')
    const startIndex = isProcessing.indexOf(true)
    for (let i = startIndex; i < dataAdapters.length; i++) {
      const dataAdapter = dataAdapters[i]
      isProcessing[i] = true

      // const processBatch = buildProcessBatch(isProcessing, dataFilePath)
      _.set(internalConfig, ['sources', mlsSourceName, 'processBatch'], processBatch)
      flushInternalConfig()

      try {
        await dataAdapter.syncData(mlsResource, data)
      } catch (e) {
        processBatch.error = serializeError(e)
        processBatch.errorCount++
        _.set(internalConfig, ['sources', mlsSourceName, 'processBatch'], processBatch)
        flushInternalConfig()
        return
      }
      isProcessing[i] = false
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'processBatch'])
    flushInternalConfig()
  }

  function buildDataAdapter(dataAdapterObj) {
    const dataAdapterType = dataAdapterObj.type
    if (dataAdapterType === 'mysql') {
      return mysqlDataAdapter(userConfig, mlsSourceName, dataAdapterObj.config)
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

  return {
    getPrimaryDataAdapter,
    closeConnections,
  }
}
