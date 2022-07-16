const { getMlsSourceUserConfig } = require('../../../config')
const { getIndexes } = require('./mlsIndexes')
const moment = require('moment')
const { getItemsForMissingRecordsUsingInOperator } = require('../shared')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'com.mlsgrid.metadata').EntityType
  }

  function shouldIncludeJsonField(fieldName) {
    if (fieldName.startsWith('@odata')) {
      return false
    }
    if (fieldName === 'MlgCanView') {
      return false
    }
    return null
  }

  function shouldIncludeMetadataField(fieldName) {
    if (fieldName === 'MlgCanView') {
      return false
    }
    return null
  }

  async function fetchAuth(userConfig, mlsSourceName) {
    const sourceConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
    return {
      accessToken: sourceConfig.accessToken,
      // As far into the future as possible
      expiresAt: 2147483647 * 1000,
    }
  }

  function useOrderByForPurgeAndReconcile() {
    return false
  }

  function getItemsForMissingRecords(args) {
    return getItemsForMissingRecordsUsingInOperator({
      ...args,
      // TODO: I don't actually know MLS Grid's max length. I'm using 7168 for now because I copied it from the code for
      // Trestle and it seems to work. So it could be higher.
      urlMaxLength: 7168,
    })
  }

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
    getIndexes,
    useOrderByForPurgeAndReconcile,
    getItemsForMissingRecords,
  }
}
