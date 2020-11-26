const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const axios = require('axios')
const _ = require('lodash')
const xml2js = require('xml2js')
const fsPromises = require('fs').promises
const pathLib = require('path')

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
  const userConfig = buildUserConfig()
  const mlsSourceName = 'aborTrestle'
  let internalConfig = await getInternalConfig()
  let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})
  if (!auth.expiresAt || auth.expiresAt < Date.now()) {
    auth = await fetchAuth(userConfig, internalConfig, mlsSourceName)
  }
  const metadataPath = _.get(userConfig, ['sources', mlsSourceName, 'metadataPath'])
  let metadataString
  if (metadataPath) {
    metadataString = await fsPromises.readFile(metadataPath, 'utf8')
  } else {
    const metadataUrl = 'https://api-prod.corelogic.com/trestle/odata/$metadata'
    metadataString = await axios({
      url: metadataUrl,
      headers: {
        Accept: 'application/xml',
        Authorization: 'Bearer ' + auth.accessToken,
        responseType: 'text',
      },
    })
      .then(response => {
        return response.data
      })
      .catch(catcher('get metadata'))
  }
  const parser = new xml2js.Parser()
  const metadata = await parser.parseStringPromise(metadataString)
    .catch(catcher('parse metadata'))
  const dataAdapterName = userConfig.sources[mlsSourceName].dataAdapterName
  let dataAdapter
  if (dataAdapterName === 'mysql') {
    dataAdapter = require('./dataAdapters/mysql')
    await dataAdapter.syncStructure(userConfig, mlsSourceName, metadata)
      .catch(catcher('sync structure'))
  }

  for (const mlsResource of userConfig.sources[mlsSourceName].mlsResources) {
    const { modificationTimestamp, photosChangeTimestamp } = await dataAdapter.getTimestamps(userConfig, mlsSourceName, mlsResource)
    const modificationTimestampString = (modificationTimestamp).toISOString()
    const photosChangeTimestampString = (photosChangeTimestamp).toISOString()
    let url = userConfig.sources[mlsSourceName].replicationEndpoint
      .replace('{resource}', mlsResource)
      .replace('{modificationTimestamp}', modificationTimestampString)
      .replace('{photosChangeTimestamp}', photosChangeTimestampString)
    while (url) {
      // const dataFilePath = pathLib.resolve(__dirname + '/../../config/sources/abor_trestle/data_Property.json')

      const mlsData = await axios({
        url,
        headers: {
          Authorization: 'Bearer ' + auth.accessToken,
        },
      })
        .then(response => response.data)
      // await fsPromises.writeFile(dataFilePath, JSON.stringify(mlsData))

      // const fileContents = await fsPromises.readFile(dataFilePath, 'utf8')
      // const mlsData = JSON.parse(fileContents)

      let data = mlsData.value
      // let data = [mlsData.value[0]]
      await dataAdapter.syncData(userConfig, mlsSourceName, mlsResource, data)
        .catch(catcher('sync data'))
      url = mlsData['@odata.nextLink']
    }
  }
}

go()
  .catch(catcher('go'))
