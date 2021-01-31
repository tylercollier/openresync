const _ = require('lodash')
const moment = require('moment')

// The devnull adapter is basically a fake adapter. It's a black hole for data. It's usefulness is for testing.

module.exports = (userConfig, mlsSourceName, destinationConfig) => {
  function setPlatformAdapter(adapter) {
    // Do nothing
  }

  function setPlatformDataAdapter(adapter) {
    // Do nothing
  }

  async function syncStructure(metadata, mlsResource, indexes) {
    // Do nothing
  }

  async function syncData(mlsResource, mlsData) {
    // Do nothing
  }

  async function getTimestamps(mlsResource, indexes) {
    const updateTimestampFields = _.pickBy(indexes, v => v.isUpdateTimestamp)
    return _.mapValues(updateTimestampFields, () => new Date(0))
  }

  async function getAllIds(mlsResource, indexes) {
    return []
  }

  async function purge(mlsResource, idsToPurge) {
    // Do nothing
  }

  async function closeConnection() {
    // Do nothing
  }

  return {
    syncStructure,
    syncData,
    getTimestamps,
    closeConnection,
    setPlatformAdapter,
    setPlatformDataAdapter,
    getAllIds,
    purge,
  }
}
