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
  expandUrl,
} = require('./utils')
const { getBatch, getMlsSourceUserConfig, getMlsSourceInternalConfig } = require('../config')
const { makePlatformAdapter } = require('./platformAdapters/index')

module.exports = function(mlsSourceName, configBundle, eventEmitter, loggerArg) {
  const logger = loggerArg.child({ source: mlsSourceName })
  const { userConfig, internalConfig, flushInternalConfig } = configBundle
  const mlsSourceUserConfig = getMlsSourceUserConfig(userConfig, mlsSourceName)
  const mlsSourceInternalConfig = getMlsSourceInternalConfig(internalConfig, mlsSourceName)
  let destinationManager
  const platformAdapterName = mlsSourceUserConfig.platformAdapterName
  const platformAdapter = makePlatformAdapter(platformAdapterName)

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
    const items = (await getMlsResourceDirFiles(mlsSourceName, mlsResourceName) || [])
      .filter(x => pathLib.basename(x).startsWith(batchType + '_batch_'))
    if (!items.length) {
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
      let loopCount = 0
      const maxLoops = 3
      while (!metadataString) {
        loopCount++
        try {
          metadataString = await axios({
            url: metadataEndpoint,
            headers: {
              Accept: 'application/xml',
              Authorization: 'Bearer ' + auth.accessToken,
              responseType: 'text',
              'Accept-Encoding': 'gzip, deflate',
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
            // .catch(catcher('get metadata'))
        } catch (error) {
          if (loopCount <= maxLoops
            && (error.code === 'EAI_AGAIN' || !'debug' || (error.response && error.response.status >= 500))) {
            // Will loop
            console.log(`There was a problem with the request, trying again (${loopCount})`)
          } else {
            catcher('get metadata')(error)
          }
        }
      }
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

  function getOp(timestamp, batchAlreadyExisted) {
    // FIXME: I'm not sure what kind of timestamp I have here. It seems like sometimes it's a Date
    // and sometimes it's a moment object.
    if (batchAlreadyExisted || (timestamp.getTime && timestamp.getTime() === 0) && (timestamp.unix && timestamp.unix())) {
      return 'ge'
    }
    return 'gt'
  }

  function makeUrl(mlsResourceObj, timestamps, top, batchAlreadyExisted, indexes, select, expand = true) {
    const url = mlsSourceUserConfig.getReplicationEndpoint(mlsResourceObj)
    // Create a filter condition where the timestamps are greater than what we've previously downloaded
    // and less than or equal to our batch timestamp.
    const minTimestampsString = _.map(timestamps.minTimestamps, (value, key) =>
      `${key} ${getOp(value, batchAlreadyExisted)} ` + moment.utc(value).toISOString()
    )
      .join(' or ')
    const maxTimestampString = _.map(timestamps.maxTimestamps, (value, key) => {
      let s = `${key} le ` + moment.utc(value).toISOString()
      // We want the timestamp to be less than our max timestamp, but also include null values
      if (indexes[key].nullable) {
        s = `(${key} eq null or ${s})`
      }
      return s
    }).join(' and ')
    const updateTimestampsString = minTimestampsString
      ? `(${minTimestampsString}) and ${maxTimestampString}`
      : maxTimestampString

    const urlWithTimestamps = new URL(url)

    let filter = urlWithTimestamps.searchParams.get('$filter') || ''
    if (filter) {
      filter = '(' + filter + ') and '
    }
    // To guarantee correctness, we outfix with parens. However, for Spark, there is what appears to be a bug where they
    // don't allow extra parens. I'm waiting to hear from FBS. For now, for simplicity, don't outfix. Will need to
    // revisit later.
    if (platformAdapterName === 'spark') {
      filter += updateTimestampsString
    } else {
      filter += '(' + updateTimestampsString + ')'
    }
    if (platformAdapterName === 'mlsGrid') {
      // TODO: This is for MlsGrid. Perhaps a bug that they properly don't support (potentially unnecessary) parens? In
      // the demo data, I was getting different results when parens were used, even though the parens weren't actually
      // needed.
      // This will break any user config supplied filtering that relies on parens, but nothing I can do for now.
      // Update: I found this in their "best practices guide" (find link to PDF at https://www.mlsgrid.com/resources):
      //   DO NOT use parentheses around anything other than “or” statements or “in” statements in
      //   your request. Avoid placing parentheses around OriginatingSystemName, MlgCanView, or
      //   ModificationTimestamp.
      filter = filter.replace(/\(/g, '')
      filter = filter.replace(/\)/g, '')
    }
    urlWithTimestamps.searchParams.set('$filter', filter)
    if (select) {
      let _select = select
      const primaryKeyFieldName = getPrimaryKeyField(mlsResourceObj.name, indexes)
      if (!_select.includes(primaryKeyFieldName)) {
        _select = [primaryKeyFieldName, ...select]
      }
      urlWithTimestamps.searchParams.set('$select', _select.join(','))
    }
    if (mlsSourceUserConfig.useOrderBy) {
      urlWithTimestamps.searchParams.set('$orderby', _.map(timestamps, (v, k) => `${k} asc`).join(','))
    }
    urlWithTimestamps.searchParams.set('$count', true)
    if (expand) {
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
        'Accept-Encoding': 'gzip, deflate',
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

  async function isDownloadNeeded(batchType) {
    let batchName
    if (batchType === 'sync') {
      batchName = 'downloadSyncBatch'
    } else if (batchType === 'purge') {
      batchName = 'purgeBatch'
    } else if (batchType === 'reconcile') {
      batchName = 'purgeReconcileBatch'
    } else {
      throw new Error(`Error 544581903 Unexpected batchType ${batchType}`)
    }

    const batchAlreadyExisted = !!_.get(mlsSourceInternalConfig, batchName)
    if (batchAlreadyExisted) {
      return true
    }

    // If any files exist, for any resource (but there is no download batch data, as checked above), that means the
    // previous download batch completed and a download is not needed.
    let mlsResources = mlsSourceUserConfig.mlsResources
    for (const mlsResourceObj of mlsResources) {
      const mlsResourceName = mlsResourceObj.name
      const items = (await getMlsResourceDirFiles(mlsSourceName, mlsResourceName) || [])
        .filter(x => pathLib.basename(x).startsWith(batchType + '_batch_'))
      if (items.length) {
        return false
      }
    }

    return true
  }

  async function fetchWithProgressWithRetry({ url, mlsResourceName, auth, catcherMsg }) {
    let mlsDataString
    let mlsData
    let loopCount = 0
    const maxLoops = 3
    while (!mlsDataString) {
      loopCount++
      await fetchWithProgress({
        url,
        headers: {
          Authorization: 'Bearer ' + auth.accessToken,
        },
      })
        .then(responseString => {
          try {
            mlsData = JSON.parse(responseString)
            mlsDataString = responseString
          } catch (error) {
            if (error instanceof SyntaxError && loopCount <= maxLoops) {
              console.log(`There was a problem parsing the response, trying again (${loopCount})`)
            } else {
              throw error
            }
          }
        })
        .catch(error => {
          if (loopCount <= maxLoops
            && (error.code === 'EAI_AGAIN' || !'debug' || (error.response && error.response.status >= 500))) {
            // Will loop
            console.log(`There was a problem with the request, trying again (${loopCount})`)
          } else {
            catcher(catcherMsg)(error, { resource: mlsResourceName })
          }
        })
    }
    return { mlsData, mlsDataString }
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
      const indexes = platformAdapter.getIndexes(mlsResourceName)
      let minTimestamps
      const mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsResourceName, 'sync')
      if (mostRecentMlsData) {
        minTimestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
        logger.info({ resource: mlsResourceName, ...minTimestamps }, 'Using timestamps from recently downloaded files')
      }
      if (!minTimestamps) {
        minTimestamps = await destinationManager.getPrimaryDataAdapter().getTimestamps(mlsResourceName, indexes)
        logger.info({ resource: mlsResourceName, ...minTimestamps }, 'Using timestamps from primary data adapter')
      }
      const top = mlsSourceUserConfig.top
      if (!top) {
        throw new Error('You must specify a "top" parameter in the config')
      }
      let select = mlsResourceObj.select
      // For ARMLS Spark:
      // When downloading, ignore what's in the config's $select. This makes it so we download everything. While this is
      // much more data, we'll do it at least for the initial download, so that we can have all the data, which will
      // make it easier for us to later say "You know, we also want to map an additional field" without having to do a
      // bunch of awkward work to go download that single extra field for all the existing records. What we'd probably
      // do is delete all data out of MySQL and Solr, resync from our saved-off initial data, and then run the sync to
      // bring us back up to date.
      //
      // But, we need the $select in the config because there are 2800+ fields in the metadata, and of course MySQL
      // can't handle that.
      //
      if (mlsSourceName.startsWith('armls_spark')) {
        select = null;
      }

      const timestamps = {
        minTimestamps,
        maxTimestamps: _.mapValues(minTimestamps, () => batchTimestamp),
      }
      let url = makeUrl(mlsResourceObj, timestamps, top, batchAlreadyExisted, indexes, select)
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
        logger.info(pageCountObj, `Downloading page number (of expected total pages) of sync data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const { mlsData, mlsDataString } = await fetchWithProgressWithRetry({
          url,
          mlsResourceName,
          auth,
          catcherMsg: 'download sync',
        })
        const fileName = makeBatchFileName('sync', convertTimestampToBatchId(batchTimestamp))
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving sync data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during debug/testing to force only syncing a single page of data.
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

  async function downloadAddFieldsData() {
    logger.info('Start downloading add-fields data')
    let auth = _.get(mlsSourceInternalConfig, ['auth'], {})

    let mlsResources = mlsSourceUserConfig.mlsResources

    const batchAlreadyExisted = !!_.get(mlsSourceInternalConfig, 'downloadAddFieldsBatch')
    const downloadAddFieldsBatch = getOrBuildBatch(mlsResources, 'downloadAddFieldsBatch')
    _.set(mlsSourceInternalConfig, ['downloadAddFieldsBatch'], downloadAddFieldsBatch)
    await flushInternalConfig()

    mlsResources = filterMlsResourcesFromBatch(mlsResources, downloadAddFieldsBatch)
    const batchTimestamp = downloadAddFieldsBatch.batchTimestamp
    logger.debug({ batchTimestamp, batchId: convertTimestampToBatchId(batchTimestamp) }, 'Timestamps for download add-fields batch')

    for (const mlsResourceObj of mlsResources) {
      const mlsResourceName = mlsResourceObj.name
      logger.info({ resource: mlsResourceName }, 'Start downloading add-field data for resource')
      const indexes = platformAdapter.getIndexes(mlsResourceName)
      let minTimestamps
      const mostRecentMlsData = await getMostRecentlyDownloadedFileData(mlsResourceName, 'addFields')
      if (mostRecentMlsData) {
        minTimestamps = getTimestampsFromMlsData(mostRecentMlsData, indexes)
        logger.info({ resource: mlsResourceName, ...minTimestamps }, 'Using min timestamps from recently downloaded files')
      }
      let maxTimestamps = await destinationManager.getPrimaryDataAdapter().getTimestamps(mlsResourceName, indexes)
      // The maxTimestamps will be the unix epoch if there are no records in the DB. We'll replace the unix epoch with
      // now.
      maxTimestamps = _.mapValues(maxTimestamps, (value, key) => {
        const m = moment.utc(value)
        if (m.unix() === 0) {
          return moment.utc()
        }
        return m
      })
      logger.info({ resource: mlsResourceName, ...maxTimestamps }, 'Max timestamps from primary data adapter')
      const top = mlsSourceUserConfig.top
      if (!top) {
        throw new Error('You must specify a "top" parameter in the config')
      }
      let select = mlsResourceObj.selectForAddFields
      const timestamps = {
        minTimestamps,
        maxTimestamps,
      }
      let url = makeUrl(mlsResourceObj, timestamps, top, batchAlreadyExisted, indexes, select, false)
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
        logger.info(pageCountObj, `Downloading page number (of expected total pages) of add-fields data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const { mlsData, mlsDataString } = await fetchWithProgressWithRetry({
          url,
          mlsResourceName,
          auth,
          catcherMsg: 'download add-fields',
        })
        const fileName = makeBatchFileName('addFields', convertTimestampToBatchId(batchTimestamp))
        const mlsResourceDir = getMlsResourceDir(mlsSourceName, mlsResourceName)
        if (!hasEnsuredDirectoryExists) {
          await mkdirIfNotExists(mlsResourceDir)
          hasEnsuredDirectoryExists = true
        }
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving add-fields data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)
        url = mlsData['@odata.nextLink']
        // Useful during debug/testing to force only syncing a single page of data.
        // url = null
        const recordCount = mlsData.value.length
        logger.info({ resource: mlsResourceName, recordCount }, 'Payload contained number of add-fields records')
        if (count !== mlsData['@odata.count']) {
          count = mlsData['@odata.count']
          logger.info({count}, '@odata.count')
        }
      }

      downloadAddFieldsBatch.mlsResourcesStatus.find(x => x.name === mlsResourceName).done = true
      await flushInternalConfig()
      logger.info({ resource: mlsResourceName }, 'Done downloading add-fields data for resource')
    }
    _.unset(mlsSourceInternalConfig, ['downloadAddFieldsBatch'])
    await flushInternalConfig()
    logger.info('Done downloading add-fields data for resources')
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
      const indexes = platformAdapter.getIndexes(mlsResourceName)
      const primaryKey = getPrimaryKeyField(mlsResourceName, indexes)
      const isExpandedMlsResource = !topLevelMlsResources.find(x => x === mlsResourceObj)
      let url = new URL(mlsSourceUserConfig.getPurgeEndpoint(mlsResourceObj, isExpandedMlsResource))
      url.searchParams.set('$select', primaryKey)
      const top = mlsSourceUserConfig.topForPurge
      if (!top) {
        throw new Error('You must specify a "topForPurge" parameter in the config')
      }
      url.searchParams.set('$count', 'true')
      url.searchParams.set('$top', top)
      if (mlsSourceUserConfig.useOrderBy && _.result(platformAdapter, 'useOrderByForPurgeAndReconcile', true)) {
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
        logger.info(pageCountObj, `Downloading page number (of expected total pages) of purge data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({resource: mlsResourceName, url}, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const { mlsData, mlsDataString } = await fetchWithProgressWithRetry({
          url,
          mlsResourceName,
          auth,
          catcherMsg: 'download purge',
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
      const indexes = platformAdapter.getIndexes(mlsResourceName)
      const primaryKey = getPrimaryKeyField(mlsResourceName, indexes)
      const timestampFields = getTimestampFields(mlsResourceName, indexes)
      let fn = mlsSourceUserConfig.getReconcileEndpoint || mlsSourceUserConfig.getPurgeEndpoint
      let url = new URL(fn(mlsResourceObj, false))
      const selectFields = [primaryKey, ...timestampFields]
      url.searchParams.set('$select', selectFields)
      const top = mlsSourceUserConfig.topForPurge
      if (!top) {
        throw new Error('You must specify a "topForPurge" parameter in the config')
      }
      url.searchParams.set('$count', 'true')
      url.searchParams.set('$top', top)
      if (mlsSourceUserConfig.useOrderBy && _.result(platformAdapter, 'useOrderByForPurgeAndReconcile', true)) {
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
        logger.info(pageCountObj, `Downloading page number (of expected total pages) of reconcile data`)
        // Show the initial download URL, and the follow-up one which will be from the nextLink key in the response and
        // will look like ...?id=[some UUID]. Since it doesn't change, we only need to log it once.
        if (downloadPageCount <= 2) {
          logger.debug({ resource: mlsResourceName, url }, 'Download URL')
        }
        auth = await ensureAuthIsNotExpired(auth)
        const { mlsData, mlsDataString } = await fetchWithProgressWithRetry({
          url,
          mlsResourceName,
          auth,
          catcherMsg: 'download reconcile',
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
      const downloadReconcileBatch = getBatch(mlsSourceInternalConfig, 'downloadReconcileBatch')
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
      const mlsIndexes = platformAdapter.getIndexes(mlsResourceName)
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

      // Here's what's happening here. We wish we could download (e.g.) 1000 records at once. But since we are using the
      // 'in' operator to get a bunch of arbitrary IDs, the URL might be longer than what the platform allows. So we'll
      // carefully build a URL that is short enough to be allowed and download that many at a time.
      while (missingIds.length) {
        const { url, firstId, lastId, recordsToDownloadCount } = platformAdapter.getItemsForMissingRecords({
          mlsResourceObj,
          top: mlsSourceUserConfig.top,
          missingIds,
          resourceEndpoint: mlsSourceUserConfig.getResourceEndpoint(mlsResourceObj),
          primaryKey,
          // Passing this function is my way of satisfying 1) not mutating it from getItemsForMissingRecords(), and 2)
          // not needlessly making copies of it, because it could be large.
          shiftMissingIds: () => missingIds.shift(),
        })
        auth = await ensureAuthIsNotExpired(auth)
        logger.info({ firstId, lastId }, 'First ID and last ID to download')
        const maxUrlDisplayLength = 503
        logger.debug({ resource: mlsResourceName, url: ellipsis(url, maxUrlDisplayLength) }, `Download URL (first ${maxUrlDisplayLength - '...'.length} chars)`)
        logger.info({ count: recordsToDownloadCount, total: missingIds.length + recordsToDownloadCount }, 'Downloading X out of remaining Y records')
        const { mlsData, mlsDataString } = await fetchWithProgressWithRetry({
          url,
          mlsResourceName,
          auth,
          catcherMsg: 'download missing',
        })
        const fileName = makeBatchFileName('missing', convertTimestampToBatchId(batchTimestamp))
        const dataFilePath = pathLib.resolve(mlsResourceDir, fileName)
        logger.debug({ resource: mlsResourceName, dataFilePath }, 'Saving missing data to file')
        await fsPromises.writeFile(dataFilePath, mlsDataString)
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
      await deleteFilesForMlsResource(mlsResourceName, filesForMlsResource, logger)
    }

    _.unset(mlsSourceInternalConfig, ['downloadMissingBatch'])
    await flushInternalConfig()
    logger.info('Done downloading missing data for resources')
  }

  function setDestinationManager(manager) {
    destinationManager = manager
    destinationManager.setPlatformAdapter(platformAdapter)
  }

  return {
    downloadMlsResources,
    downloadMlsMetadata,
    downloadPurgeData,
    setDestinationManager,
    fetchCountAndMostRecent,
    downloadReconcileData,
    downloadMissingData,
    isDownloadNeeded,
    downloadAddFieldsData,

    private: {
      makeUrl,
    },
  }
}
