const _ = require('lodash')
const moment = require('moment')

// The devnull adapter is basically a fake adapter. It's a black hole for data. It's usefulness is for helping me
// not get stuck in thinking in terms of a single data adapter, but multiple.

// Arguably each function should have parameters with the same signature as its peers like the mysql data adapter.
// However, as the API is in such flux, I'm going to not have them so I don't need to keep updating them.

module.exports = () => {
  function setPlatformAdapter() {
    // Do nothing
  }

  function setPlatformDataAdapter() {
    // Do nothing
  }

  async function syncStructure() {
    // Do nothing
  }

  async function syncData() {
    // Do nothing
  }

  async function getTimestamps(mlsResourceName, indexes) {
    const updateTimestampFields = _.pickBy(indexes, v => v.isUpdateTimestamp)
    return _.mapValues(updateTimestampFields, () => new Date(0))
  }

  async function getAllIds() {
    return []
  }

  async function getCount() {
    return 0
  }

  async function getMostRecentTimestamp(mlsResourceName) {
    return null
  }

  async function purge() {
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
    getCount,
  }
}
