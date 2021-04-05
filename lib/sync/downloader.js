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
  flattenExpandedMlsResources,
  mkdirIfNotExists,
} = require('./utils')
const { getIndexes } = require('./indexes')
const { getBatch, getMlsSourceUserConfig, getMlsSourceInternalConfig } = require('../config')

module.exports = function(mlsSourceName, configBundle, eventEmitter, loggerArg) {
  const logger = loggerArg.child({ source: mlsSourceName })
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const mlsSourceUserConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
  const mlsSourceInternalConfig = getMlsSourceInternalConfig(internalConfig, mlsSourceName)
  let destinationManager
  let platformAdapter

  const platformAdapterName = mlsSourceUserConfig.platformAdapterName
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

  async function getMostRecentlyDownloadedFileData(mlsResourceName) {
    const items = await getMlsResourceDirFiles(mlsSourceName, mlsResourceName)
    if (!items || !items.length) {
      return null
    }
    // If the most recent file is empty, look at the next most recent, and so on. This will happen whenever there
    // are 0 listings to sync since the most recent sync.
    // Also, Bridge Interactive seems to have an extra @odata.nextUrl at the end of a batch when it knows that that URL
    // will return 0 records. I don't know why. But we can't use it to try to get timestamps. So, ignore it.
    for (let i = 1; i <= items.length; i++) {
      const pathOfMostRecentFile = items[items.length - i]
      const fileContents = await fsPromises.readFile(pathOfMostRecentFile, 'utf8')
      const mlsData = JSON.parse(fileContents)
      if (mlsData.value.length) {
        return mlsData
      }
    }
    return null
  }

  function getOrBuildBatch(mlsResources, batchName) {
    const batch = getBatch(mlsSourceInternalConfig, batchName)
    if (batch) {
      return batch
    }
    return {
      batchTimestamp: moment.utc(),
      mlsResourcesStatus: _.map(mlsResources, mlsResourceObj => ({
        name: mlsResourceObj.name,
        done: false,
      }))
    }
  }

  function filterMlsResourcesFromBatch(mlsResources, batch) {
    const mlsResourceNamesFromBatch = batch.mlsResourcesStatus.map(x => x.name)
    if (!_.isEqual(mlsResources.map(x => x.name), mlsResourceNamesFromBatch)) {
      // TODO: provide instructions to the user on how to do this "cleaning".
      throw new Error('You have unfinished downloads for a previous batch, and have changed the list of resources.'
        + ' Please clean out the unfinished download batch.'
      )
    }

    return mlsResources.filter(mlsResourceObj => {
      const batchResource = batch.mlsResourcesStatus.find(x => x.name === mlsResourceObj.name)
      return !batchResource.done
    })
  }

  async function ensureAuthIsNotExpired(auth) {
    if (!auth.expiresAt || auth.expiresAt < Date.now()) {
      logger.info('Fetching auth')
      const refreshedAuth = await platformAdapter.fetchAuth(userConfig, mlsSourceName)
      logger.info('Successfully fetched auth')
      _.set(mlsSourceInternalConfig, ['auth'], refreshedAuth)
      await flushInternalConfig()
      return refreshedAuth
    }
    return auth
  }

  async function downloadMlsMetadata() {
    logger.info('Start downloading MLS metadata')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})

    const metadataPath = mlsSourceUserConfig.metadataPath
    let metadataString
    if (metadataPath) {
      logger.debug({ metadataPath }, 'Using metadata from path')
      metadataString = await fsPromises.readFile(metadataPath, 'utf8')
    } else {
      const metadataEndpoint = mlsSourceUserConfig.metadataEndpoint
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
        //   // const metadataPath = pathLib.resolve(__dirname, '../../config/sources/abor_bridge_interactive/actris_ref_metadata.xml')
        //   const metadataPath = pathLib.resolve(__dirname, '../../config/sources/abor_trestle/austin_metadata_trestle.xml')
        //   await fsPromises.writeFile(metadataPath, data)
        //   return data
        // })
        .catch(catcher('get metadata'))
    }
    logger.info('Done downloading MLS metadata')
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

  function expandUrl(mlsResourceObj) {
    let s = ''
    s += mlsResourceObj.fieldName
    const urlSearchParams = new URLSearchParams()
    if (mlsResourceObj.select) {
      urlSearchParams.set('$select', mlsResourceObj.select.join(','))
    }
    if (mlsResourceObj.expand) {
      urlSearchParams.set('$expand', mlsResourceObj.expand.map(expandUrl).join(','))
    }
    if (urlSearchParams.toString().length) {
      const decoded = decodeURIComponent(urlSearchParams.toString())
      s += `(${decoded})`
    }
    return s
  }

  function makeUrl(mlsResourceObj, timestamps, batchTimestamp, top) {
    const url = mlsSourceUserConfig.getReplicationEndpoint(mlsResourceObj)
    // TODO: The 'gt' here (greater than) should really be ge unless we are certain that the previous
    // download batch completed. So, figure out a way to determine if the previous download batch completed.
    // It seems like a simple way would be to just see if there is a downloadSyncBatch. If not, use gt, otherwise use ge.
    // The exception is if the timestamps are the unix epoch, in which case we should use gte.
    //
    // Create a filter condition where the timestamps are greater than what we've previously downloaded
    // and less than or equal to our batch timestamp.
    const gtTimestampsString = _.map(timestamps, (value, key) => `${key} gt ` + moment.utc(value).toISOString()).join(' or ')
    const ltBatchTimestampString = _.map(timestamps, (value, key) => `${key} le ` + batchTimestamp.toISOString()).join(' and ')
    const updateTimestampsString = `(${gtTimestampsString}) and ${ltBatchTimestampString}`

    const urlWithTimestamps = new URL(url)

    let filter = urlWithTimestamps.searchParams.get('$filter') || ''
    if (filter) {
      filter += ' and '
    }
    filter += updateTimestampsString
    urlWithTimestamps.searchParams.set('$filter', filter)
    if (mlsResourceObj.select) {
      urlWithTimestamps.searchParams.set('$select', mlsResourceObj.select.join(','))
    }
    if (mlsSourceUserConfig.useOrderBy) {
      urlWithTimestamps.searchParams.set('$orderby', _.map(timestamps, (v, k) => `${k} asc`).join(', '))
    }
    urlWithTimestamps.searchParams.set('$count', true)
    if (mlsResourceObj.expand) {
      urlWithTimestamps.searchParams.set('$expand', mlsResourceObj.expand.map(expandUrl).join(','))
    }
    urlWithTimestamps.searchParams.set('$top', top)
    const urlString = urlWithTimestamps.toString()
    return urlString
  }

  async function fetchCountAndMostRecent(mlsResourceObj) {
    const url = new URL(mlsSourceUserConfig.getResourceEndpoint(mlsResourceObj))
    url.searchParams.set('$count', true)
    url.searchParams.set('$top', 1)
    url.searchParams.set('$orderby', 'ModificationTimestamp desc')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})
    auth = await ensureAuthIsNotExpired(auth)
    return axios({
      url: url.toString(),
      headers: {
        Authorization: 'Bearer ' + auth.accessToken,
      },
    })
      .then(response => response.data)
      .then(data => {
        const mostRecent = data.value.length ? data.value[0] : null
        return {
          count: data['@odata.count'],
          mostRecent,
        }
      })
  }

  async function downloadMlsResources() {
    logger.info('Start downloading sync data for resources')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})

    let mlsResources = mlsSourceUserConfig.mlsResources

    const downloadSyncBatch = getOrBuildBatch(mlsResources, 'downloadSyncBatch')
    _.set(mlsSourceInternalConfig, ['downloadSyncBatch'], downloadSyncBatch)
    await flushInternalConfig()

    mlsResources = filterMlsResourcesFromBatch(mlsResources, downloadSyncBatch)
    const batchTimestamp = downloadSyncBatch.batchTimestamp
    logger.debug({ batchTimestamp, batchId: convertTimestampToBatchId(batchTimestamp) }, 'Timestamps for download sync batch')

    for (const mlsResourceObj of mlsResources) {
      const mlsResourceName = mlsResourceObj.name
      logger.info({ resource: mlsResourceName }, 'Start downloading sync data for resource')
      const indexes = getIndexes(mlsResourceName)
      let timestamps
      const mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsResourceName)
      if (mostRecentMlsData) {
        timestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
        logger.info({ resource: mlsResourceName, ...timestamps }, 'Using timestamps from recently downloaded files')
      }
      if (!timestamps) {
        timestamps = await destinationManager.getPrimaryDataAdapter().getTimestamps(mlsResourceName, indexes)
        logger.info({ resource: mlsResourceName, ...timestamps }, 'Using timestamps from primary data adapter')
      }
      // const top = mlsSourceUserConfig.top
      // For debug
      const top = 10
      if (!top) {
        throw new Error('You must specify a "top" parameter in the config')
      }
      let url = makeUrl(mlsResourceObj, timestamps, batchTimestamp, top)
      let hasEnsuredDirectoryExists = false
      let downloadPageCount = 0
      // Count is @odata.count which will be returned from first API response
      let count = null
      let expectedTotalPages = null
      let previousMaxModificationTimestamp = null
      while (url) {
        downloadPageCount++
        const pageCountObj = { resource: mlsResourceName, downloadPageCount }
        if (count) {
          if (!expectedTotalPages) {
            expectedTotalPages = Math.ceil(count / top)
          }
          pageCountObj.expectedTotalPages = expectedTotalPages
        }
        logger.info(pageCountObj, `Downloading page number of sync data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const mlsDataString = await fetchWithProgress({
          url,
          headers: {
            Authorization: 'Bearer ' + auth.accessToken,
          },
        })
          .catch(error => {
            logger.error({ err: error.response, resource: mlsResourceName })
            throw error
          })
        const fileName = makeBatchFileName('sync', convertTimestampToBatchId(batchTimestamp))
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
        // Since the ABOR sample dataset is never updated, here's what we'll do to test it.
        // Download the first X pages and stop. This will kind of simulate that more are added, because the next time we
        // run it, we'll have some left to do (until we've got them all).
        // However, there's a problem. If we decide to stop at X pages, we can't tell if there would have been more
        // records with the same timestamp, and the next time we run and use "gt" to fetch records, we might miss
        // some. So, we'll keep going as long as the ModificationTimestamp doesn't change.
        if (downloadPageCount > 10) {
          if (mlsData.value) {
            for (let i = 0; i < mlsData.value.length; i++) {
              const record = mlsData.value[i]
              if (record.ModificationTimestamp !== previousMaxModificationTimestamp) {
                mlsData.value.splice(i)
                url = null
                break
              }
            }
          }
        }
        if (mlsData.value && mlsData.value.length) {
          previousMaxModificationTimestamp = mlsData.value[mlsData.value.length - 1].ModificationTimestamp
        }

        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving sync data to file')
        // await fsPromises.writeFile(dataFilePath, mlsDataString)
        await fsPromises.writeFile(dataFilePath, JSON.stringify(mlsData))

        const recordCount = mlsData.value.length
        logger.info({ resource: mlsResourceName, recordCount }, 'Payload contained number of sync records')
        if (count !== mlsData['@odata.count']) {
          count = mlsData['@odata.count']
          logger.info({count}, '@odata.count')
        }
      }

      downloadSyncBatch.mlsResourcesStatus.find(x => x.name === mlsResourceName).done = true
      await flushInternalConfig()
      logger.info({ resource: mlsResourceName }, 'Done downloading sync data for resource')
    }
    _.unset(mlsSourceInternalConfig, ['downloadSyncBatch'])
    await flushInternalConfig()
    logger.info('Done downloading sync data for resources')
  }

  async function downloadPurgeData() {
    logger.info('Start downloading purge data for resources')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})

    const topLevelMlsResources = mlsSourceUserConfig.mlsResources
    // There's not a good way (that I know of) to determine which "expanded" records exist.
    // Thus, the best thing to do (and probably simplest, with the exception of "do nothing") is to download the keys
    // for the entirety of the dataset of the expanded resources. We use flattenExpandedMlsResources to know what those
    // other MLS resources are.
    let mlsResources = flattenExpandedMlsResources(topLevelMlsResources)

    const batchAlreadyExisted = !!_.get(mlsSourceInternalConfig, ['purgeBatch'])
    const purgeBatch = getOrBuildBatch(mlsResources, 'purgeBatch')
    if (batchAlreadyExisted) {
      logger.debug('Found existing download purge batch data')
    } else {
      _.set(mlsSourceInternalConfig, ['purgeBatch'], purgeBatch)
      await flushInternalConfig()
    }

    const batchTimestamp = purgeBatch.batchTimestamp
    const batchId = convertTimestampToBatchId(batchTimestamp)
    logger.debug({ batchTimestamp, batchId }, 'Timestamps for download purge batch')
    if (batchAlreadyExisted) {
      // Go delete all the files from non-finished resources.
      // Note: As I write this, I know of two sources, Bridge Interactive and Trestle.
      // Trestle allows $orderby, and also allows up to 300,000 results when you select just the key field from a
      // resource. So while the $orderby is useful, it's almost moot since 300,000 can be fetched at one time.
      // On the other hand, Bridge Interactive doesn't allow $orderby, and they only allow 2,000 results at a time.
      // I think the simplest thing to do for both is to just delete all existing files for the non finished portions
      // of the batch. Someday we can do the work of handling $orderby; perhaps there will be a source that allows
      // $orderby but has a small $top cap.
      logger.info('Deleting existing downloaded files for unfinished download purge batch')
      await deleteSourceFilesForBatch(mlsSourceName, mlsResources, 'purge', batchId, logger)
    }

    mlsResources = filterMlsResourcesFromBatch(mlsResources, purgeBatch)

    for (const mlsResourceObj of mlsResources) {
      const mlsResourceName = mlsResourceObj.name
      logger.info({ resource: mlsResourceName }, 'Start downloading purge data for resource')
      const indexes = getIndexes(mlsResourceName)
      const primaryKey = getPrimaryKeyField(mlsResourceName, indexes)
      const isExpandedMlsResource = !topLevelMlsResources.find(x => x === mlsResourceObj)
      let url = new URL(mlsSourceUserConfig.getPurgeEndpoint(mlsResourceObj, isExpandedMlsResource))
      url.searchParams.set('$select', primaryKey)
      const top = mlsSourceUserConfig.topForPurge
      if (!top) {
        throw new Error('You must specify a "topForPurge" parameter in the config')
      }
      url.searchParams.set('$top', top)
      if (mlsSourceUserConfig.useOrderBy) {
        url.searchParams.set('$orderby', `${primaryKey} asc`)
      }
      url = url.toString()
      let hasEnsuredDirectoryExists = false
      let downloadPageCount = 0
      // Count is @odata.count which will be returned from first API response
      let count = null
      let expectedTotalPages = null
      while (url) {
        downloadPageCount++
        const pageCountObj = { resource: mlsResourceName, downloadPageCount }
        if (count) {
          if (!expectedTotalPages) {
            expectedTotalPages = Math.ceil(count / top)
          }
          pageCountObj.expectedTotalPages = expectedTotalPages
        }
        logger.info(pageCountObj, `Downloading page number of purge data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const mlsDataString = await fetchWithProgress({
          url,
          headers: {
            Authorization: 'Bearer ' + auth.accessToken,
          },
        })
          .catch(error => {
            logger.error({ err: error.response, resource: mlsResourceName })
            throw error
          })
        const fileName = makeBatchFileName('purge', batchId);
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving purge data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
        const recordCount = mlsData.value.length
        logger.info({ resource: mlsResourceName, recordCount }, 'Payload contained number of purge records')
        count = mlsData['@odata.count']
      }

      purgeBatch.mlsResourcesStatus.find(x => x.name === mlsResourceName).done = true
      await flushInternalConfig()
      logger.info({ resource: mlsResourceName }, 'Done downloading purge data for resource')
    }
    _.unset(mlsSourceInternalConfig, ['purgeBatch'])
    await flushInternalConfig()
    logger.info('Done downloading purge data for resources')
  }

  function setDestinationManager(manager) {
    destinationManager = manager
  }

  return {
    downloadMlsResources,
    downloadMlsMetadata,
    downloadPurgeData,
    setDestinationManager,
    fetchCountAndMostRecent,

    private: {
      makeUrl,
    },
  }
}
