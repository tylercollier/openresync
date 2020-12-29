const axios = require('axios')
const { catcher } = require('../utils')

module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'CoreLogic.DataStandard.RESO.DD').EntityType
  }

  function filterField(fieldName) {
    return !fieldName.startsWith('X_')
  }

  async function fetchAuth(config, mlsSourceName) {
    const baseUrl = 'https://api-prod.corelogic.com/trestle/oidc/connect/token'
    const tokenParams = {
      client_id: config.sources[mlsSourceName].clientId,
      client_secret: config.sources[mlsSourceName].clientSecret,
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
    filterField,
    fetchAuth,
  }
}