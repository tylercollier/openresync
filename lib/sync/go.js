const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const axios = require('axios')
const _ = require('lodash')
const xml2js = require('xml2js')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const moment = require('moment')
const { catcher: catcherUtil, fetchWithProgress } = require('./utils')

let dataAdapter
let platformAdapter
let platformDataAdapter

const catcher = msg => catcherUtil(msg, { dataAdapter })

function getIndexes(mlsResource) {
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

function getMlsResourceDir(mlsSourceName, mlsResource) {
  const dirPath = pathLib.resolve(__dirname, `../../config/sources/${mlsSourceName}/downloadedData/${mlsResource}`)
  return dirPath
}

function getTimestampsFromMlsData(mlsData, indexes) {
  const resourceData = mlsData.value
  const updateTimestampFields = _.pickBy(indexes, (v, k) => v.isUpdateTimestamp)
  const updateTimestamps = _.mapValues(updateTimestampFields, () => moment(new Date(0)))
  const keyNames = Object.keys(updateTimestampFields)
  for (const record of resourceData) {
    for (keyName of keyNames) {
      if (moment(record[keyName]).isAfter(updateTimestamps[keyName])) {
        updateTimestamps[keyName] = moment(record[keyName])
      }
    }
  }
  return updateTimestamps
}

async function getMostRecentlyDownloadedFileData(mlsSourceName, mlsResource) {
  const dirPath = getMlsResourceDir(mlsSourceName, mlsResource)
  try {
    await fsPromises.access(dirPath)
  } catch (e) {
    return null
  }
  const items = (await fsPromises.readdir(dirPath, { withFileTypes: true }))
    .filter(item => !item.isDirectory())
    .map(item => item.name)
    .sort()
  if (!items.length) {
    return null
  }
  const pathOfMostRecentFile = pathLib.resolve(dirPath, items[items.length - 1])
  const fileContents = await fsPromises.readFile(pathOfMostRecentFile, 'utf8')
  const mlsData = JSON.parse(fileContents)
  return mlsData
}

/*
  downloadBatch looks like this:
  downloadBatch: [{
    batchTimestamp: '2020-12-28T12:00:00Z',
    mlsResourcesStatus: [{
      name: 'Property',
      done: true,
    }, {
      name: 'Member',
      done: false,
    }],
  }]
 */
function getOrBuildDownloadBatch(mlsResources, internalConfig, mlsSourceName) {
  const downloadBatch = _.get(internalConfig, ['sources', mlsSourceName, 'downloadBatch'])
  if (!downloadBatch) {
    return {
      batchTimestamp: moment.utc(),
      mlsResourcesStatus: _.map(mlsResources, resource => ({
        name: resource,
        done: false,
      }))
    }
  }
  downloadBatch.batchTimestamp = moment(downloadBatch.batchTimestamp)
  return downloadBatch
}

function filterMlsResourcesFromDownloadBatch(mlsResources, downloadBatch) {
  const mlsResourceNamesFromDownloadBatch = downloadBatch.mlsResourcesStatus.map(x => x.name)
  if (!_.isEqual(mlsResources, mlsResourceNamesFromDownloadBatch)) {
    // TODO: provide instructions to the user on how to do this "cleaning".
    throw new Error('You have unfinished downloads for a previous batch, and have changed the list of MLS resources.'
      + ' Please clean out the unfinished download batch.'
    )
  }

   return mlsResources.filter(mlsResource => {
    const batchResource = downloadBatch.mlsResourcesStatus.find(x => x.name === mlsResource)
    return !batchResource.done
  })
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

  let mlsResources = userConfig.sources[mlsSourceName].mlsResources

  for (const mlsResource of mlsResources) {
    const indexes = getIndexes(mlsResource)
    await dataAdapter.syncStructure(metadata, mlsResource, indexes)
      .catch(catcher('sync structure'))
  }

  const downloadBatch = getOrBuildDownloadBatch(mlsResources, internalConfig, mlsSourceName)
  _.set(internalConfig, ['sources', mlsSourceName, 'downloadBatch'], downloadBatch)
  flushInternalConfig()

  mlsResources = filterMlsResourcesFromDownloadBatch(mlsResources, downloadBatch)
  const batchTimestamp = downloadBatch.batchTimestamp

  let mostRecentMlsData = null
  for (const mlsResource of mlsResources) {
    const indexes = getIndexes(mlsResource)
    let timestamps
    if (!mostRecentMlsData) {
      mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsSourceName, mlsResources)
    }
    if (mostRecentMlsData) {
      timestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
    }
    if (!timestamps) {
      timestamps = await dataAdapter.getTimestamps(mlsResource, indexes)
    }
    let url = userConfig.sources[mlsSourceName].replicationEndpoint
      .replace('{resource}', mlsResource)
    // TODO: The 'gt' here (greater than) should really be ge unless we are certain that the previous
    // download batch completed. So, figure out a way to determine if the previous download batch completed.
    // It seems like a simple way would be to just seem if there is a downloadBatch. If not, use gt, otherwise use ge.
    // The exception is if the timestamps are the unix epoch, in which case we should use gte.
    //
    // Create a filter condition where the timestamps are greater than what we've previously downloaded
    // and less than or equal to our batch timestamp.
    const updateTimestamps = _.map(timestamps, (value, key) => `${key} gt ` + moment(value).toISOString()).join(' and ')
      + ' and '
      + _.map(timestamps, (value, key) => `${key} le ` + batchTimestamp.toISOString()).join(' and ')

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
    let hasEnsuredDirectoryExists = false
    while (url) {
      auth = await ensureAuthIsNotExpired(auth)
      const mlsDataString = await fetchWithProgress({
        url,
        headers: {
          Authorization: 'Bearer ' + auth.accessToken,
        },
      })
        .catch(error => {
          console.log('error.response', error.response)
          throw error
        })
      const fileNameTimestampFormatString = 'YYYY-MM-DD-T-HH-mm-ss-SSS'
      const fileName = 'batch_'
        + batchTimestamp.format(fileNameTimestampFormatString)
        + '_seq_'
        + moment.utc().format(fileNameTimestampFormatString)
        + '.json'
      const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResource)
      if (!hasEnsuredDirectoryExists) {
        try {
          await fsPromises.access(mlsResourceDir)
        } catch (e) {
          if (e.code === 'ENOENT') {
            await fsPromises.mkdir(mlsResourceDir, {
              recursive: true,
              mode: 0o775,
            })
          } else {
            throw e
          }
        }
        hasEnsuredDirectoryExists = true
      }
      const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
      await fsPromises.writeFile(dataFilePath, mlsDataString)

      // let resourceData = mlsData.value
      // // Useful for debugging: get just the first record
      // // let resourceData = [mlsData.value[0]]
      // await dataAdapter.syncData(mlsResource, resourceData)
      //   .catch(catcher('sync data'))

      const mlsData = JSON.parse(mlsDataString)
      mostRecentMlsData = mlsData
      url = mlsData['@odata.nextLink']
      // Useful during testing to force only syncing a single page of data.
      // url = null
    }

    downloadBatch.mlsResourcesStatus.find(x => x.name === mlsResource).done = true
    _.set(internalConfig, ['sources', mlsSourceName, 'downloadBatch'], downloadBatch)
    flushInternalConfig()
  }
  _.unset(internalConfig, ['sources', mlsSourceName, 'downloadBatch'])
  flushInternalConfig()

  await dataAdapter.closeConnection()
}

// go('aborTrestle')
go('aborBridgeInteractive')
  .catch(catcher('go'))
