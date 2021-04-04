const axios = require('axios')
const { catcher } = require('../utils')
const { getMlsSourceUserConfig } = require('../../config')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'CoreLogic.DataStandard.RESO.DD').EntityType
  }

  function shouldIncludeJsonField(fieldName) {
    // I'm reusing the shouldIncludeMetadataField method because it currently matches the functionality that I want.
    // But it's not necessarily that way. See the BridgeInteractive platform adapter as an example.
    // So, don't be afraid to split this out if necessary.
    return shouldIncludeMetadataField(fieldName)
  }

  function shouldIncludeMetadataField(fieldName) {
    // We could filter out fields that have an Annotation where their StandardName is blank.
    // I'm assuming this means it's specific to Trestle.
    // I'm not sure if people want such data so I'll leave it in for now.

    if (fieldName.startsWith('X_')) {
      return false
    }
    return null
  }

  async function fetchAuth(userConfig, mlsSourceName) {
    const baseUrl = 'https://api-prod.corelogic.com/trestle/oidc/connect/token'
    const sourceConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
    const tokenParams = {
      client_id: sourceConfig.clientId,
      client_secret: sourceConfig.clientSecret,
      scope: 'api',
      grant_type: 'client_credentials',
    }
    const tokenParamsString = Object.entries(tokenParams)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&')
    const responseData = await axios({
      url: baseUrl,
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
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

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
  }
}
