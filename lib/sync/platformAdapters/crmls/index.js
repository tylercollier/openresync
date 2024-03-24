const axios = require('axios')
const { catcher } = require('../../utils')
const { getMlsSourceUserConfig } = require('../../../config')
const { getIndexes } = require('./mlsIndexes')
const { getItemsForMissingRecordsUsingOrOperator } = require('../shared')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'OData.Models').EntityType
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
    const baseUrl = 'https://soc.crmls.org/connect/token'
    const sourceConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
    const tokenParams = {
      client_id: sourceConfig.clientId,
      client_secret: sourceConfig.clientSecret,
      scope: 'ODataApi',
      grant_type: 'client_credentials',
    }
    const tokenParamsString = Object.entries(tokenParams)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&')
    const responseData = await axios({
      url: baseUrl,
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'gzip, deflate',
      },
      data: tokenParamsString,
    })
      .then(response => response.data)
      .catch(catcher('get token'))
    const auth = {
      accessToken: responseData.access_token,
      expiresAt: Date.now() + responseData.expires_in * 1000,
    }
    return auth
  }

  function getItemsForMissingRecords(args) {
    return getItemsForMissingRecordsUsingOrOperator({
      ...args,
      // 7168 is a guess, originally copied from the Trestle adapter.
      urlMaxLength: 7168,
      shouldQuote: false,
    })
  }

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
    getIndexes,
    getItemsForMissingRecords,
  }
}
