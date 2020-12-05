const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const axios = require('axios')
const _ = require('lodash')
const xml2js = require('xml2js')
const fsPromises = require('fs').promises
const pathLib = require('path')
const moment = require('moment')

let dataAdapter

function catcher(msg) {
  return function(error) {
    console.log('Error in ' + msg)
    console.log('error', error)
    let p = Promise.resolve()
    if (dataAdapter) {
      p = dataAdapter.closeConnection()
    }
    p.then(() => {
      process.exit(1)
    })
  }
}

async function fetchAuth(config, internalConfig, mlsSourceName) {
  // // This is for Trestle
  // const baseUrl = 'https://api-prod.corelogic.com/trestle/oidc/connect/token'
  // const tokenParams = {
  //   client_id: config.sources[mlsSourceName].clientId,
  //   client_secret: config.sources[mlsSourceName].clientSecret,
  //   scope: 'api',
  //   grant_type: 'client_credentials',
  // }
  // const tokenParamsString = Object.entries(tokenParams)
  //   .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
  //   .join('&')
  // const responseData = await axios({
  //   url: baseUrl,
  //   method: 'post',
  //   headers: {
  //     'Content-Type': 'application/x-www-form-urlencoded'
  //   },
  //   data: tokenParamsString,
  // })
  //   .then(response => response.data)
  //   .catch(catcher('get token'))
  // const auth = {
  //   accessToken: responseData.access_token,
  //   expiresAt: Date.now() + responseData.expires_in * 1000,
  // }
  // _.set(internalConfig, ['sources', mlsSourceName, 'auth'], auth)
  // flushInternalConfig()
  // return auth

  // This is for Bridge Interactive
  return {
    accessToken: config.sources[mlsSourceName].accessToken,
    expiresAt: 2147483647 * 1000,
  }
}

function getIndexesToAdd(mlsResource) {
  let indexes = {}
  if (mlsResource === 'Property') {
    indexes = {
      ListingKey: {
        fields: ['ListingKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      PhotosChangeTimestamp: {
        fields: ['PhotosChangeTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResource === 'Media') {
    indexes = {
      MediaKey: {
        fields: ['MediaKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      MediaModificationTimestamp: {
        fields: ['MediaModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResource === 'Member') {
    indexes = {
      MemberKey: {
        fields: ['MemberKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResource === 'Office') {
    indexes = {
      OfficeKey: {
        fields: ['OfficeKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResource === 'CustomProperty') {
    indexes = {
      ListingKey: {
        fields: ['ListingKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResource === 'OpenHouse') {
    indexes = {
      OpenHouseKey: {
        fields: ['OpenHouseKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKey: { fields: ['ListingKey'] },
      OpenHouseId: { fields: ['OpenHouseId'] },
    }
  } else if (mlsResource === 'PropertyRooms') {
    indexes = {
      RoomKey: {
        fields: ['RoomKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKey: { fields: ['ListingKey'] },
    }
  } else if (mlsResource === 'TeamMembers') {
    indexes = {
      TeamMemberKey: {
        fields: ['TeamMemberKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      MemberKey: { fields: ['MemberKey'] },
      MemberMlsId: { fields: ['MemberMlsId'] },
      TeamKey: { fields: ['TeamKey'] },
    }
  } else if (mlsResource === 'Teams') {
    indexes = {
      TeamKey: {
        fields: ['TeamKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      TeamLeadKey: { fields: ['TeamLeadKey'] },
      TeamLeadMlsId: { fields: ['TeamLeadMlsId'] },
    }
  } else {
    throw new Error('Unknown MLS resource: ' + mlsResource)
  }
  return indexes
}

async function go(mlsSourceName) {
  const userConfig = buildUserConfig()
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
    // const metadataUrl = 'https://api-prod.corelogic.com/trestle/odata/$metadata'
    const metadataUrl = 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/$metadata'
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
  if (dataAdapterName === 'mysql') {
    dataAdapter = require('./dataAdapters/mysql')(userConfig, mlsSourceName)
  } else {
    throw new Error('Unknown data adapter: ' + dataAdapterName)
  }

  const mlsResources = userConfig.sources[mlsSourceName].mlsResources

  for (const mlsResource of mlsResources) {
    const indexes = getIndexesToAdd(mlsResource)
    await dataAdapter.syncStructure(metadata, mlsResource, indexes)
      .catch(catcher('sync structure'))
  }

  for (const mlsResource of mlsResources) {
    const indexes = getIndexesToAdd(mlsResource)
    const timestamps = await dataAdapter.getTimestamps(mlsResource, indexes)
    let url = userConfig.sources[mlsSourceName].replicationEndpoint
      .replace('{resource}', mlsResource)
    const updateTimestamps = _.map(timestamps, (value, key) => `${key} gt ` + moment(value).toISOString()).join(' and ')

    const urlWithTimestamps = new URL(url)
    urlWithTimestamps.searchParams.set('$filter', updateTimestamps)
    // urlWithTimestamps.searchParams.set('$orderby', _.map(timestamps, (v, k) => `${k} asc`).join(', '))
    urlWithTimestamps.searchParams.set('$count', true)
    urlWithTimestamps.searchParams.set('$top', _.get(userConfig, ['sources', mlsSourceName, 'top'], 1000))
    url = urlWithTimestamps.toString()
    while (url) {
      // const dataFilePath = pathLib.resolve(__dirname + '/../../config/sources/abor_trestle/data_Property.json')

      const mlsData = await axios({
        url,
        headers: {
          Authorization: 'Bearer ' + auth.accessToken,
        },
      })
        .then(response => response.data)
        .catch(error => {
          console.log('error.response', error.response)
          throw error
        })
      // await fsPromises.writeFile(dataFilePath, JSON.stringify(mlsData))

      // const fileContents = await fsPromises.readFile(dataFilePath, 'utf8')
      // const mlsData = JSON.parse(fileContents)

      let data = mlsData.value
      // let data = [mlsData.value[0]]
      await dataAdapter.syncData(mlsResource, data)
        .catch(catcher('sync data'))
      url = mlsData['@odata.nextLink']
      // Useful during testing to force only syncing a single page of data.
      url = null
    }
  }

  await dataAdapter.closeConnection()
}

// go('aborTrestle')
go('aborBridgeInteractive')
  .catch(catcher('go'))
