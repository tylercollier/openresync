const axios = require('axios')
const { catcher } = require('../../utils')
const { getMlsSourceUserConfig } = require('../../../config')
const { getIndexes } = require('./mlsIndexes')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'Odata.Models').EntityType
  }

  function shouldIncludeJsonField(fieldName) {
    // I'm reusing the shouldIncludeMetadataField method because it currently matches the functionality that I want.
    // But it's not necessarily that way. See the BridgeInteractive platform adapter as an example.
    // So, don't be afraid to split this out if necessary.
    return shouldIncludeMetadataField(fieldName)
  }

  function shouldIncludeMetadataField(fieldName) {
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

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
    getIndexes,
  }
}
