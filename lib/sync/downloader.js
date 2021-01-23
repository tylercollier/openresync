const axios = require('axios')
const _ = require('lodash')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const moment = require('moment')
const { catcher: catcherUtil, fetchWithProgress, getMlsResourceDir, getMlsResourceDirFiles } = require('./utils')
const { getIndexes } = require('./indexes')

module.exports = function(mlsSourceName, configBundle, eventEmitter) {
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  let destinationManager
  let platformAdapter

  const platformAdapterName = userConfig.sources[mlsSourceName].platformAdapterName
  if (platformAdapterName === 'bridgeInteractive') {
    platformAdapter = require('./platformAdapters/bridgeInteractive')()
  } else if (platformAdapterName === 'trestle') {
    platformAdapter = require('./platformAdapters/trestle')()
  } else {
    throw new Error('Unknown platform adapter: ' + platformAdapterName)
  }

  const catcher = msg => catcherUtil(msg, { destinationManager })

  function getTimestampsFromMlsData(mlsData, indexes) {
    const resourceData = mlsData.value
    const updateTimestampFields = _.pickBy(indexes, (v, k) => v.isUpdateTimestamp)
    const updateTimestamps = _.mapValues(updateTimestampFields, () => moment.utc(new Date(0)))
    const keyNames = Object.keys(updateTimestampFields)
    for (const record of resourceData) {
      for (keyName of keyNames) {
        if (moment.utc(record[keyName]).isAfter(updateTimestamps[keyName])) {
          updateTimestamps[keyName] = moment.utc(record[keyName])
        }
      }
    }
    return updateTimestamps
  }

  async function getMostRecentlyDownloadedFileData(mlsResource) {
    const items = await getMlsResourceDirFiles(mlsResource)
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
  function getOrBuildDownloadBatch(mlsResources) {
    const downloadBatch = _.get(internalConfig, ['sources', mlsSourceName, 'downloadBatch'])
    if (downloadBatch) {
      downloadBatch.batchTimestamp = moment.utc(downloadBatch.batchTimestamp)
      return downloadBatch
    }
    return {
      batchTimestamp: moment.utc(),
      mlsResourcesStatus: _.map(mlsResources, resource => ({
        name: resource,
        done: false,
      }))
    }
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

  async function ensureAuthIsNotExpired(auth) {
    if (!auth.expiresAt || auth.expiresAt < Date.now()) {
      const refreshedAuth = await platformAdapter.fetchAuth(userConfig, mlsSourceName)
      _.set(internalConfig, ['sources', mlsSourceName, 'auth'], refreshedAuth)
      await flushInternalConfig()
      return refreshedAuth
    }
    return auth
  }

  async function downloadMlsMetadata() {
    let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})

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
    return metadataString
  }

  async function downloadMlsResources() {
    let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})

    let mlsResources = userConfig.sources[mlsSourceName].mlsResources

    const downloadBatch = getOrBuildDownloadBatch(mlsResources)
    _.set(internalConfig, ['sources', mlsSourceName, 'downloadBatch'], downloadBatch)
    await flushInternalConfig()

    mlsResources = filterMlsResourcesFromDownloadBatch(mlsResources, downloadBatch)
    const batchTimestamp = downloadBatch.batchTimestamp

    for (const mlsResource of mlsResources) {
      const indexes = getIndexes(mlsResource)
      let timestamps
      const mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsResource)
      if (mostRecentMlsData) {
        timestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
      }
      if (!timestamps) {
        timestamps = await destinationManager.getPrimaryDataAdapter().getTimestamps(mlsResource, indexes)
      }
      let url = userConfig.sources[mlsSourceName].getReplicationEndpoint(mlsResource)
      // TODO: The 'gt' here (greater than) should really be ge unless we are certain that the previous
      // download batch completed. So, figure out a way to determine if the previous download batch completed.
      // It seems like a simple way would be to just see if there is a downloadBatch. If not, use gt, otherwise use ge.
      // The exception is if the timestamps are the unix epoch, in which case we should use gte.
      //
      // Create a filter condition where the timestamps are greater than what we've previously downloaded
      // and less than or equal to our batch timestamp.
      const updateTimestampsString = _.map(timestamps, (value, key) => `${key} gt ` + moment.utc(value).toISOString()).join(' and ')
        + ' and '
        + _.map(timestamps, (value, key) => `${key} le ` + batchTimestamp.toISOString()).join(' and ')

      const urlWithTimestamps = new URL(url)

      let filter = urlWithTimestamps.searchParams.get('$filter') || ''
      if (filter) {
        filter += ' and '
      }
      filter += updateTimestampsString
      urlWithTimestamps.searchParams.set('$filter', filter)
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
        console.log('Starting download')
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
        const mlsResourceDir = getMlsResourceDir(mlsResource)
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

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null

        eventEmitter.emit('downloaded', {
          mlsResource,
          dataFilePath,
          mlsData,
        })
      }

      downloadBatch.mlsResourcesStatus.find(x => x.name === mlsResource).done = true
      _.set(internalConfig, ['sources', mlsSourceName, 'downloadBatch'], downloadBatch)
      await flushInternalConfig()
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'downloadBatch'])
    await flushInternalConfig()
  }

  function setDestinationManager(manager) {
    destinationManager = manager
  }

  return {
    downloadMlsResources,
    downloadMlsMetadata,
    setDestinationManager,
  }
}
