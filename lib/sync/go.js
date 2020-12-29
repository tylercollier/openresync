const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const axios = require('axios')
const _ = require('lodash')
const xml2js = require('xml2js')
const fsPromises = require('fs').promises
const pathLib = require('path')
const moment = require('moment')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')

let dataAdapter
let platformAdapter
let platformDataAdapter

const catcher = msg => catcherUtil(msg, { dataAdapter })

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
  async function ensureAuthIsNotExpired(auth) {
    if (!auth.expiresAt || auth.expiresAt < Date.now()) {
      const refreshedAuth = await platformAdapter.fetchAuth(userConfig, mlsSourceName)
      _.set(internalConfig, ['sources', mlsSourceName, 'auth'], refreshedAuth)
      flushInternalConfig()
      return refreshedAuth
    }
    return auth
  }

  const metadataPath = _.get(userConfig, ['sources', mlsSourceName, 'metadataPath'])
  let metadataString
  if (metadataPath) {
    metadataString = await fsPromises.readFile(metadataPath, 'utf8')
  } else {
    const metadataEndpoint = userConfig.sources[mlsSourceName].metadataEndpoint
    if (!metadataEndpoint) {
      throw new Error('You must specify a metadata endpoint in the config')
    }
    auth = await ensureAuthIsNotExpired(auth)
    metadataString = await axios({
      url: metadataEndpoint,
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
  const platformAdapterName = userConfig.sources[mlsSourceName].platformAdapterName
  if (platformAdapterName === 'bridgeInteractive') {
    platformAdapter = require('./platformAdapters/bridgeInteractive')()
  } else if (platformAdapterName === 'trestle') {
    platformAdapter = require('./platformAdapters/trestle')()
  } else {
    throw new Error('Unknown platform adapter: ' + platformAdapterName)
  }
  dataAdapter.setPlatformAdapter(platformAdapter)
  platformDataAdapter = require(`./platformDataAdapters/${platformAdapterName}/${dataAdapterName}`)()
  dataAdapter.setPlatformDataAdapter(platformDataAdapter)

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
    if (userConfig.sources[mlsSourceName].useOrderBy) {
      urlWithTimestamps.searchParams.set('$orderby', _.map(timestamps, (v, k) => `${k} asc`).join(', '))
    }
    urlWithTimestamps.searchParams.set('$count', true)
    const top = userConfig.sources[mlsSourceName].top
    if (!top) {
      throw new Error('You must specify a "top" parameter in the config')
    }
    urlWithTimestamps.searchParams.set('$top', top)
    url = urlWithTimestamps.toString()
    while (url) {
      // const dataFilePath = pathLib.resolve(__dirname + '/../../config/sources/abor_trestle/data_Property.json')

      auth = await ensureAuthIsNotExpired(auth)
      const mlsData = await fetchWithProgress({
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

      let resourceData = mlsData.value
      // let resourceData = [mlsData.value[0]]
      await dataAdapter.syncData(mlsResource, resourceData)
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
