const { getMlsSourceUserConfig } = require('../../../config')
const { getIndexes } = require('./mlsIndexes')
const moment = require('moment')

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

  function modifyUrlForPurge(url, mlsResourceObj, isExpandedMlsResource, lastPurgedAt) {
    const datetimeString = moment.unix(lastPurgedAt).utc().toISOString()
    const filter = url.searchParams.get('$filter')
    url.searchParams.set('$filter', `${filter} and ModificationTimestamp ge ${datetimeString}`)
  }

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
    getIndexes,
    useOrderByForPurgeAndReconcile,
    modifyUrlForPurge,
  }
}
