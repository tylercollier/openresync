const axios = require('axios')
const { catcher } = require('../../utils')
const { getMlsSourceUserConfig } = require('../../../config')
const { getIndexes } = require('./mlsIndexes')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'ODataService').EntityType
    // return [
    //   {
    //     $: {
    //       Name: 'Property',
    //       Property: [
    //
    //       ],
    //     },
    //   }, {
    //     $: {
    //       Name: 'Media',
    //     },
    //   },
    // ]
  }

  function shouldIncludeJsonField(fieldName) {
    if (fieldName.startsWith('@odata')) {
      return false
    }
    if (fieldName.endsWith('@Core.Permissions')) {
      return false
    }
    return null
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
