const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const axios = require('axios')
const _ = require('lodash')

function catcher(msg) {
  return function(error) {
    console.log('Error in ' + msg)
    console.log('error', error)
    process.exit(1)
  }
}

async function fetchAuth(config, internalConfig, mlsSourceName) {
  // This is for Trestle
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
  _.set(internalConfig, ['sources', mlsSourceName, 'auth'], auth)
  flushInternalConfig()
  return auth
}

async function go() {
  const config = buildUserConfig()
  const mlsSourceName = 'aborTrestle'
  let internalConfig = await getInternalConfig()
  let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})
  if (!auth.expiresAt || auth.expiresAt < Date.now()) {
    auth = await fetchAuth(config, internalConfig, mlsSourceName)
  }
  const metadataUrl = 'https://api-prod.corelogic.com/trestle/odata/$metadata'
  const metadata = await axios({
    url: metadataUrl,
    headers: {
      Accept: 'application/xml',
      Authorization: 'Bearer ' + auth.accessToken,
      responseType: 'text',
    },
  })
    .then(response => response.data)
    .catch(catcher('get metadata'))
  console.log('metadata.length', metadata.length)
}

go()
