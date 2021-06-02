const axios = require('axios')
const _ = require('lodash')
const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const moment = require('moment')
const ellipsis = require('text-ellipsis')
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
  getSourceFiles,
  getSourceFilesForBatchForMlsResource,
  getTimestampFields,
  getOldestBatchId,
  convertBatchIdToTimestamp,
  getSourceFilesForBatch,
  quote,
  deleteFilesForMlsResource,
  removeFile,
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

  async function getMostRecentlyDownloadedFileData(mlsResourceName, batchType) {
    const items = (await getMlsResourceDirFiles(mlsSourceName, mlsResourceName))
      .filter(x => pathLib.basename(x).startsWith(batchType + '_batch_'))
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

  function getOp(timestamp, batchAlreadyExisted) {
    // TODO: I'm not sure what kind of timestamp I have here. It seems like sometimes it's a Date
    // and sometimes it's a moment object.
    if (batchAlreadyExisted || (timestamp.getTime && timestamp.getTime() === 0) && (timestamp.unix && timestamp.unix())) {
      return 'ge'
    }
    return 'gt'
  }

  function makeUrl(mlsResourceObj, timestamps, batchTimestamp, top, batchAlreadyExisted) {
    const url = mlsSourceUserConfig.getReplicationEndpoint(mlsResourceObj)
    // Create a filter condition where the timestamps are greater than what we've previously downloaded
    // and less than or equal to our batch timestamp.
    const gtTimestampsString = _.map(timestamps, (value, key) => `${key} ${getOp(value, batchAlreadyExisted)} ` + moment.utc(value).toISOString()).join(' or ')
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

    const batchAlreadyExisted = !!_.get(mlsSourceInternalConfig, 'downloadSyncBatch')
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
      const mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsResourceName, 'sync')
      if (mostRecentMlsData) {
        timestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
        logger.info({ resource: mlsResourceName, ...timestamps }, 'Using timestamps from recently downloaded files')
      }
      if (!timestamps) {
        timestamps = await destinationManager.getPrimaryDataAdapter().getTimestamps(mlsResourceName, indexes)
        logger.info({ resource: mlsResourceName, ...timestamps }, 'Using timestamps from primary data adapter')
      }
      const top = mlsSourceUserConfig.top
      if (!top) {
        throw new Error('You must specify a "top" parameter in the config')
      }
      let url = makeUrl(mlsResourceObj, timestamps, batchTimestamp, top, batchAlreadyExisted)
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
        logger.info(pageCountObj, `Downloading page number of sync data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        let mlsDataString
        while (true) {
          let shouldLoop = false
          mlsDataString = await fetchWithProgress({
            url,
            headers: {
              Authorization: 'Bearer ' + auth.accessToken,
            },
          })
            .catch(error => {
              logger.error({err: error.response, resource: mlsResourceName})
              let debugHelper = false
              if (error.code === 'EAI_AGAIN' || debugHelper) {
                shouldLoop = true
              } else {
                throw error
              }
            })
          if (!shouldLoop) {
            break
          }
        }
        const fileName = makeBatchFileName('sync', convertTimestampToBatchId(batchTimestamp))
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving sync data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
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
    // UPDATE: I'm not sure how people use subresources in the wild. In my first production use, I only sync the
    // Property resource, and use expand for Media, and that's it. Media is an impractical resource to grab all the IDs,
    // even when using Trestle which allows fetching 300,000 at a time.
    // I'm going to only purge the top level resources, and have a special way to delete subresources, with Media in
    // mind.
    // let mlsResources = flattenExpandedMlsResources(topLevelMlsResources)
    let mlsResources = topLevelMlsResources

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

  async function downloadReconcileData() {
    logger.info('Start downloading reconcile data for resources')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})

    let mlsResources = mlsSourceUserConfig.mlsResources

    const batchAlreadyExisted = !!_.get(mlsSourceInternalConfig, ['downloadReconcileBatch'])
    const downloadReconcileBatch = getOrBuildBatch(mlsResources, 'downloadReconcileBatch')
    if (batchAlreadyExisted) {
      logger.debug('Found existing download reconcile batch data')
    } else {
      _.set(mlsSourceInternalConfig, ['downloadReconcileBatch'], downloadReconcileBatch)
      await flushInternalConfig()
    }

    const batchTimestamp = downloadReconcileBatch.batchTimestamp
    const batchId = convertTimestampToBatchId(batchTimestamp)
    logger.debug({ batchTimestamp, batchId }, 'Timestamps for download reconcile batch')

    mlsResources = filterMlsResourcesFromBatch(mlsResources, downloadReconcileBatch)

    for (const mlsResourceObj of mlsResources) {
      const mlsResourceName = mlsResourceObj.name
      logger.info({ resource: mlsResourceName }, 'Start downloading reconcile data for resource')
      const indexes = getIndexes(mlsResourceName)
      const primaryKey = getPrimaryKeyField(mlsResourceName, indexes)
      const timestampFields = getTimestampFields(mlsResourceName, indexes)
      let url = new URL(mlsSourceUserConfig.getPurgeEndpoint(mlsResourceObj, false))
      const selectFields = [primaryKey, ...timestampFields]
      url.searchParams.set('$select', selectFields)
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
        logger.info(pageCountObj, `Downloading page number of reconcile data`)
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
        const fileName = makeBatchFileName('reconcile', batchId);
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving reconcile data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)

        const mlsData = JSON.parse(mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during testing to force only syncing a single page of data.
        // url = null
        const recordCount = mlsData.value.length
        logger.info({ resource: mlsResourceName, recordCount }, 'Payload contained number of reconcile records')
        count = mlsData['@odata.count']
      }

      downloadReconcileBatch.mlsResourcesStatus.find(x => x.name === mlsResourceName).done = true
      await flushInternalConfig()
      logger.info({ resource: mlsResourceName }, 'Done downloading reconcile data for resource')
    }
    _.unset(mlsSourceInternalConfig, ['downloadReconcileBatch'])
    await flushInternalConfig()
    logger.info('Done downloading reconcile data for resources')
  }

  async function downloadMissingData() {
    logger.info('Starting or resuming download missing data')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})
    const mlsResources = mlsSourceUserConfig.mlsResources
    const sourceFiles = await getSourceFiles(mlsSourceName, mlsResources)
    let downloadMissingBatch = _.get(mlsSourceInternalConfig, ['downloadMissingBatch'])
    let batchId
    let batchTimestamp
    if (downloadMissingBatch) {
      logger.debug('Found existing download missing batch data')
      batchTimestamp = moment.utc(downloadMissingBatch.batchTimestamp)
      batchId = convertTimestampToBatchId(batchTimestamp)
      // TODO: ensure downloadMissingBatch's mlsResourcesStatus matches current config.
    } else {
      batchId = getOldestBatchId(sourceFiles, 'reconcile')
      if (!batchId) {
        logger.info('Found no reconcile files to process. Done.')
        return
      }
      batchTimestamp = convertBatchIdToTimestamp(batchId)
      downloadMissingBatch = {
        batchTimestamp,
        mlsResourcesStatus: mlsResources.map(mlsResourceObj => ({
          name: mlsResourceObj.name,
          done: false,
          missingIdsFilePath: null,
          lastIdDownloaded: null,
        })),
      }

      // Ensure this batch is not currently being downloaded.
      const downloadReconcileBatch = getBatch(internalConfig, mlsSourceName, 'downloadReconcileBatch')
      if (downloadReconcileBatch) {
        const downloadBatchId = convertTimestampToBatchId(downloadReconcileBatch.batchTimestamp)
        if (batchId === downloadBatchId) {
          throw new Error(`Refusing to use download reconcile batch ${batchId} because it has not finished downloading`)
        }
      }

      _.set(mlsSourceInternalConfig, ['downloadMissingBatch'], downloadMissingBatch)
      await flushInternalConfig()
    }
    logger.debug({ batchTimestamp: downloadMissingBatch.batchTimestamp, batchId }, 'Timestamp for download missing batch')
    const sourceFilesForBatch = getSourceFilesForBatch(sourceFiles, batchId, 'reconcile')

    const startIndex = downloadMissingBatch.mlsResourcesStatus.findIndex(x => !x.done)
    logger.info('Start processing reconcile data for resources')
    for (let i = startIndex; i < mlsResources.length; i++) {
      const mlsResourceObj = mlsResources[i]
      const mlsResourceStatus = downloadMissingBatch.mlsResourcesStatus[i]
      const mlsResourceName = mlsResources[i].name
      const mlsIndexes = getIndexes(mlsResourceName)
      const primaryKey = getPrimaryKeyField(mlsResourceName, mlsIndexes)
      const timestampFields = getTimestampFields(mlsResourceName, mlsIndexes)
      const filesForMlsResource = sourceFilesForBatch[i]

      let missingIds = null
      const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
      if (mlsResourceStatus.missingIdsFilePath) {
        logger.trace({ resource: mlsResourceName, filePath: mlsResourceStatus.missingIdsFilePath }, 'Reading missing IDs from file path')
        const fileContents = await fsPromises.readFile(mlsResourceStatus.missingIdsFilePath, 'utf8')
        missingIds = JSON.parse(fileContents)
      } else {
        let dataInMls = []
        for (const filePath of filesForMlsResource) {
          logger.trace({ resource: mlsResourceName, dataFilePath: filePath }, 'Reading IDs from data file path')
          const fileContents = await fsPromises.readFile(filePath, 'utf8')
          const mlsData = JSON.parse(fileContents)
          // We use mlsData.value directly, rather than map it, because we expect each of its records to have exactly the
          // data we want, meaning primary key and timestamps.
          let vals = mlsData.value
          // Debug
          // vals = _.take(mlsData.value, 6000)
          dataInMls = dataInMls.concat(vals)
          // Debug
          // break
        }
        logger.trace({ resource: mlsResourceName }, 'Sorting IDs')
        if (!mlsSourceUserConfig.useOrderBy) {
          dataInMls = _.sortBy(dataInMls, x => x[primaryKey])
        }

        missingIds = await destinationManager.getMissingIds(mlsResourceName, dataInMls, mlsIndexes)
        const fileName = makeBatchFileName('missingIds', batchId)
        const missingIdsFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.trace({ resource: mlsResourceName, filePath: missingIdsFilePath }, 'Writing missing IDs to file path')
        await fsPromises.writeFile(missingIdsFilePath, JSON.stringify(missingIds))
        mlsResourceStatus.missingIdsFilePath = missingIdsFilePath
        await flushInternalConfig()
      }

      const lastIdDownloaded = mlsResourceStatus.lastIdDownloaded
      if (lastIdDownloaded) {
        logger.trace({ resource: mlsResourceName, mostRecentIdDownlaoded: lastIdDownloaded }, 'Starting after most recent ID downloaded')
        const indexOfLastIdDownloaded = missingIds.indexOf(lastIdDownloaded)
        missingIds.splice(0, indexOfLastIdDownloaded + 1)
      }

      // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
      // See: https://stackoverflow.com/a/62436468/135101
      function fixedEncodeURIComponent(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
          return '%' + c.charCodeAt(0).toString(16);
        });
      }

      // Here's what's happening here. We wish we could download (e.g.) 1000 records at once. But since we are using the
      // 'in' operator to get a bunch of arbitrary IDs, the URL might be longer than what the platform allows. So we'll
      // carefully build a URL that is short enough to be allowed and download that many at a time. For me during
      // testing with Trestle using RECOLORADO data, I'm able to download 391 at a time. The reason it's so low is
      // due to URL encoding the comma and quotes around the IDs.
      // TODO: This is surely platform dependent, so move it to the appropriate spot.
      const urlMaxLength = 7168
      while (missingIds.length) {
        let firstId = null
        let lastId = null
        let recordsToDownloadCount = 0
        const url = (() => {
          const u = new URL(mlsSourceUserConfig.getResourceEndpoint(mlsResourceObj))
          const top = mlsSourceUserConfig.top
          u.searchParams.set('$top', top)
          const filterTemplate = `${primaryKey} in (PLACEHOLDER)`
          const filterTemplateLength = filterTemplate.replace('PLACEHOLDER', '').length
          // The -1 is for the ampersand
          const filterMaxLength = urlMaxLength - filterTemplateLength - u.toString().length - 1
          let filterString = ''
          let len = 0
          firstId = missingIds[0]
          while (missingIds.length && recordsToDownloadCount < top) {
            const id = missingIds[0]
            const maybeComma = filterString ? ',' : ''
            const idFilterString = maybeComma + quote(id)
            const idFilterStringLength = fixedEncodeURIComponent(idFilterString).length
            if (len + idFilterStringLength <= filterMaxLength) {
              missingIds.shift()
              filterString += idFilterString
              len += idFilterStringLength
              recordsToDownloadCount++
              lastId = id
            } else {
              break
            }
          }
          const filter = filterTemplate.replace('PLACEHOLDER', filterString)
          u.searchParams.set('$filter', filter)
          return u.toString()
        })()
        auth = await ensureAuthIsNotExpired(auth)
        logger.info({ firstId, lastId }, 'First ID and last ID to download')
        const maxUrlDisplayLength = 503
        logger.debug({ resource: mlsResourceName, url: ellipsis(url, maxUrlDisplayLength) }, `Download URL (first ${maxUrlDisplayLength - '...'.length} chars)`)
        logger.info({ count: recordsToDownloadCount, total: missingIds.length + recordsToDownloadCount }, 'Downloading X out of remaining Y records')
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
        const fileName = makeBatchFileName('missing', convertTimestampToBatchId(batchTimestamp))
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving missing data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)

        const mlsData = JSON.parse(mlsDataString)
        const recordCount = mlsData.value.length
        logger.info({ resource: mlsResourceName, recordCount }, 'Payload contained number of missing records')
        // TODO: Compare records returned from what we expected and log a warning if it's off

        let lastIdDownloaded = mlsData.value[mlsData.value.length - 1][primaryKey]
        if (!mlsSourceUserConfig.useOrderBy) {
          lastIdDownloaded = _.sortBy(mlsData.value, x => x[primaryKey])[primaryKey]
        }
        mlsResourceStatus.lastIdDownloaded = lastIdDownloaded
        await flushInternalConfig()
      }

      mlsResourceStatus.done = true
      await flushInternalConfig()
      logger.trace({ resource: mlsResourceName, filePath: mlsResourceStatus.missingIdsFilePath }, 'Removing missing IDs file path')
      await removeFile(mlsResourceStatus.missingIdsFilePath, mlsResourceName)
      logger.info({ resource: mlsResourceName }, 'Done downloading missing data for resource')

      logger.info({ resource: mlsResourceName }, 'Deleting reconcile files')
      await deleteFilesForMlsResource(filesForMlsResource, logger)
    }

    _.unset(mlsSourceInternalConfig, ['downloadMissingBatch'])
    await flushInternalConfig()
    logger.info('Done downloading missing data for resources')
  }

  async function computeIDsToReconcileByQueryingDestinations() {

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
    downloadReconcileData,
    downloadMissingData,

    private: {
      makeUrl,
    },
  }
}
