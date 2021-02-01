const axios = require('axios')
const _ = require('lodash')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const moment = require('moment')
const {
  catcher: catcherUtil,
  fetchWithProgress,
  getMlsResourceDir,
  getMlsResourceDirFiles,
  convertTimestampToBatchId,
  deleteSourceFilesForBatch,
  getPrimaryKeyField,
} = require('./utils')
const { getIndexes } = require('./indexes')
const { getBatch } = require('../config')

module.exports = function(mlsSourceName, configBundle, eventEmitter, loggerArg) {
  const logger = loggerArg.child({ source: mlsSourceName })
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

  const catcher = msg => catcherUtil(msg, { destinationManager, logger })

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
    const items = await getMlsResourceDirFiles(mlsSourceName, mlsResource)
    if (!items || !items.length) {
      return null
    }
    const pathOfMostRecentFile = items[items.length - 1]
    const fileContents = await fsPromises.readFile(pathOfMostRecentFile, 'utf8')
    const mlsData = JSON.parse(fileContents)
    return mlsData
  }

  function getOrBuildBatch(mlsResources, batchName) {
    const batch = getBatch(internalConfig, mlsSourceName, batchName)
    if (batch) {
      return batch
    }
    return {
      batchTimestamp: moment.utc(),
      mlsResourcesStatus: _.map(mlsResources, resource => ({
        name: resource,
        done: false,
      }))
    }
  }

  function filterMlsResourcesFromBatch(mlsResources, batch) {
    const mlsResourceNamesFromBatch = batch.mlsResourcesStatus.map(x => x.name)
    if (!_.isEqual(mlsResources, mlsResourceNamesFromBatch)) {
      // TODO: provide instructions to the user on how to do this "cleaning".
      throw new Error('You have unfinished downloads for a previous batch, and have changed the list of MLS resources.'
        + ' Please clean out the unfinished download batch.'
      )
    }

    return mlsResources.filter(mlsResource => {
      const batchResource = batch.mlsResourcesStatus.find(x => x.name === mlsResource)
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
        // .then(async data => {
        //   const metadataPath = pathLib.resolve(__dirname, '../../config/sources/abor_bridge_interactive/actris_ref_metadata.xml')
        //   const metadataPath = pathLib.resolve(__dirname, '../../config/sources/abor_trestle/austin_metadata_trestle.xml')
        //   await fsPromises.writeFile(metadataPath, data)
        //   return data
        // })
        .catch(catcher('get metadata'))
    }
    return metadataString
  }

  function makeBatchFileName(batchType, batchId) {
    const seqId = convertTimestampToBatchId(moment.utc())
    const fileName = batchType
      + '_batch_'
      + batchId
      + '_seq_'
      + seqId
      + '.json'
    return fileName;
  }

  async function downloadPurgeData() {
    let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})

    let mlsResources = userConfig.sources[mlsSourceName].mlsResources

    const batchAlreadyExisted = !!_.get(internalConfig, ['sources', mlsSourceName, 'purgeBatch'])
    const purgeBatch = getOrBuildBatch(mlsResources, 'purgeBatch')
    if (!batchAlreadyExisted) {
      _.set(internalConfig, ['sources', mlsSourceName, 'purgeBatch'], purgeBatch)
      await flushInternalConfig()
    }

    const batchTimestamp = purgeBatch.batchTimestamp
    const batchId = convertTimestampToBatchId(batchTimestamp)
    if (batchAlreadyExisted) {
      // Go delete all the files from non-finished resources.
      // Note: As I write this, I know of two sources, Bridge Interactive and Trestle.
      // Trestle allows $orderby, and also allows up to 300,000 results when you select just the key field from a
      // resource. So while the $orderby is useful, it's almost moot since 300,000 can be fetched at one time.
      // On the other hand, Bridge Interactive doesn't allow $orderby, and they only allow 2,000 results at a time.
      // I think the simplest thing to do for both is to just delete all existing files for the non finished portions
      // of the batch. Someday we can do the work of handling $orderby; perhaps there will be a source that allows
      // $orderby but has a small $top cap.
      await deleteSourceFilesForBatch(userConfig, mlsSourceName, 'purge', batchId, logger)
    }

    mlsResources = filterMlsResourcesFromBatch(mlsResources, purgeBatch)

    for (const mlsResource of mlsResources) {
      const indexes = getIndexes(mlsResource)
      const primaryKey = getPrimaryKeyField(mlsResource, indexes)
      let url = new URL(userConfig.sources[mlsSourceName].getPurgeEndpoint(mlsResource))
      url.searchParams.set('$select', primaryKey)
      const topForPurge = userConfig.sources[mlsSourceName].topForPurge
      if (!topForPurge) {
        throw new Error('You must specify a "topForPurge" parameter in the config')
      }
      url.searchParams.set('$top', topForPurge)
      if (userConfig.sources[mlsSourceName].useOrderBy) {
        url.searchParams.set('$orderby', `${primaryKey} asc`)
      }
      url = url.toString()
      let hasEnsuredDirectoryExists = false
      while (url) {
        auth = await ensureAuthIsNotExpired(auth)
        logger.info({ resource: mlsResource }, 'Starting download of purge data')
        const mlsDataString = await fetchWithProgress({
          url,
          headers: {
            Authorization: 'Bearer ' + auth.accessToken,
          },
        })
          .catch(error => {
            logger.error(error.response)
            throw error
          })
        const fileName = makeBatchFileName('purge', batchId);
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

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
      }

      purgeBatch.mlsResourcesStatus.find(x => x.name === mlsResource).done = true
      await flushInternalConfig()
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'purgeBatch'])
    await flushInternalConfig()
  }

  async function downloadMlsResources() {
    let auth = _.get(internalConfig, ['sources', mlsSourceName, 'auth'], {})

    let mlsResources = userConfig.sources[mlsSourceName].mlsResources

    const downloadUpsertBatch = getOrBuildBatch(mlsResources, 'downloadUpsertBatch')
    _.set(internalConfig, ['sources', mlsSourceName, 'downloadUpsertBatch'], downloadUpsertBatch)
    await flushInternalConfig()

    mlsResources = filterMlsResourcesFromBatch(mlsResources, downloadUpsertBatch)
    const batchTimestamp = downloadUpsertBatch.batchTimestamp

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
      // It seems like a simple way would be to just see if there is a downloadUpsertBatch. If not, use gt, otherwise use ge.
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
        logger.info({ resource: mlsResource }, 'Starting download of upsert data')
        const mlsDataString = await fetchWithProgress({
          url,
          headers: {
            Authorization: 'Bearer ' + auth.accessToken,
          },
        })
          .catch(error => {
            logger.error(error.response)
            throw error
          })
        const fileName = makeBatchFileName('upsert', convertTimestampToBatchId(batchTimestamp))
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

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
      }

      downloadUpsertBatch.mlsResourcesStatus.find(x => x.name === mlsResource).done = true
      await flushInternalConfig()
    }
    _.unset(internalConfig, ['sources', mlsSourceName, 'downloadUpsertBatch'])
    await flushInternalConfig()
  }

  function setDestinationManager(manager) {
    destinationManager = manager
  }

  return {
    downloadMlsResources,
    downloadMlsMetadata,
    downloadPurgeData,
    setDestinationManager,
  }
}
