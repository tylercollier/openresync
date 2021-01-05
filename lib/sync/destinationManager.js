const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const mysqlDataAdapter = require('./dataAdapters/mysql')

// let mlsResources = userConfig.sources[mlsSourceName].mlsResources
//
// for (const mlsResource of mlsResources) {
//   const indexes = getIndexes(mlsResource)
//   await dataAdapter.syncStructure(metadata, mlsResource, indexes)
//     .catch(catcher('sync structure'))
// }

module.exports = function(mlsSourceName, configBundle) {
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const dataAdapters = userConfig.sources[mlsSourceName].destinations.map(buildDataAdapter)

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
