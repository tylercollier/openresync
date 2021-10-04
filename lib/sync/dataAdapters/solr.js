const _ = require('lodash')
const moment = require('moment')
const solr = require('solr-client')
const { getPrimaryKeyField, getTimestampFields } = require('../utils')
const { getIndexes } = require('../indexes')
const promisify = require('util').promisify
const { shouldIncludeField } = require('../utils')
const { Worker } = require('worker_threads')
const pathLib = require("path");

module.exports = ({ destinationConfig }) => {
  let platformAdapter
  let platformDataAdapter
  const userTransform = destinationConfig.transform
  const userMakeCoreName = destinationConfig.makeCoreName
  const userMakeFieldName = destinationConfig.makeFieldName

  function setPlatformAdapter(adapter) {
    platformAdapter = adapter
  }

  function setPlatformDataAdapter(adapter) {
    platformDataAdapter = adapter
  }

  async function syncStructure() {
    // This is TODO
  }

  function makeName(name) {
    return name
  }

  function makeFieldName(mlsResourceName, name) {
    return userMakeFieldName ? userMakeFieldName(mlsResourceName, name) : makeName(name)
  }

  function makeCoreName(mlsResourceName) {
    return userMakeCoreName ? userMakeCoreName(mlsResourceName) : makeName(name)
  }

  function transform(mlsResourceName, record, metadata, cache) {
    if (userTransform) {
      return userTransform(mlsResourceName, record, metadata, cache)
    }
    return record
  }

  function makeSolrClient(mlsResourceName) {
    const coreName = makeCoreName(mlsResourceName)
    if (!coreName) {
      return
    }
    // TODO: Check config is valid
    const solrClient = solr.createClient({
      host: destinationConfig.host || 'localhost',
      port: destinationConfig.port || 8983,
      core: coreName,
      get_max_request_entity_size: 1,
    })
    return solrClient
  }

  async function syncData(mlsResourceObj, mlsData, metadata) {
    if (!mlsData.length) {
      return
    }
    const solrClient = makeSolrClient(mlsResourceObj.name)
    const indexes = getIndexes(mlsResourceObj.name)
    let fieldNames = Object.keys(mlsData[0])
      .filter(fieldName => shouldIncludeField(fieldName, indexes, platformAdapter.shouldIncludeJsonField, mlsResourceObj.select))
      // Filter out the 'expand' values, which we (should, but don't yet) handle with a recursive call below.
      .filter(fieldName => !mlsResourceObj.expand || !mlsResourceObj.expand.map(sub => sub.fieldName).includes(fieldName))
    // The "cache" is an (originally an empty) object that we pass each time to the transform function. This allows the
    // transform function to do lookup work when it chooses, e.g. it could do it all on the first pass and not again,
    // or it could potentially do it only on-demand somehow. But we don't have to force it to do it at any particular
    // time.
    const cache = {}
    const transformedMlsData = mlsData.map(x => {
      const val = _.pick(x, fieldNames)
      return transform(mlsResourceObj.name, val, metadata, cache)
    })
    await promisify(solrClient.add.bind(solrClient))(transformedMlsData)
    await promisify(solrClient.commit.bind(solrClient))()
    // TODO: I should handle syncing 'expand' resources here. See the MySQL data adapter as an example.
    // I'm not doing it now to save time because I don't need it for my current use case.
  }

  async function getTimestamps(mlsResourceName, indexes) {
    const solrClient = makeSolrClient(mlsResourceName)
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes)
    const solrTimestampFieldNames = timestampFieldNames.map(x => makeFieldName(mlsResourceName, x))
    const sort = solrTimestampFieldNames.reduce((a, v) => {
      a[v] = 'DESC'
      return a
    }, {})
    const query = solrClient.createQuery()
      .q('*:*')
      .fl(solrTimestampFieldNames)
      .sort(sort)
      .rows(1)
    const results = await promisify(solrClient.search.bind(solrClient))(query)
    return results.response.docs
  }

  async function getAllIds(mlsResourceName, indexes) {
    const solrClient = makeSolrClient(mlsResourceName)
    const countRows = await _getCount(solrClient)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const query = solrClient.createQuery()
      .q('*:*')
      .fl(userFieldName)
      .rows(countRows)
    const results = await promisify(solrClient.search.bind(solrClient))(query)
    const ids = results.response.docs.map(x => x[userFieldName])
    return ids
  }

  // A few different functions need counts, so I'm creating this private function so that only a single solrClient
  // object needs to be created when those functions are used (the solrClient object can be shared).
  async function _getCount(solrClient) {
    const query = solrClient.createQuery()
      .q('*:*')
      .rows(0)
    const results = await promisify(solrClient.search.bind(solrClient))(query)
    return results.response.numFound
  }

  async function getCount(mlsResourceName) {
    const solrClient = makeSolrClient(mlsResourceName)
    return _getCount(solrClient)
  }

  async function getMostRecentTimestamp(mlsResourceName) {
    const solrClient = makeSolrClient(mlsResourceName)
    const query = solrClient.createQuery()
      .q('*:*')
      .fl('ModificationTimestamp')
      .sort({ ModificationTimestamp: 'DESC' })
      .rows(1)
    const results = await promisify(solrClient.search.bind(solrClient))(query)
    if (!results.response.docs.length) {
      return null
    }
    return results.response.docs[0].ModificationTimestamp
  }

  async function purge(mlsResourceObj, idsToPurge, getIndexes) {
    const mlsResourceName = mlsResourceObj.name
    const solrClient = makeSolrClient(mlsResourceName)
    const indexes = getIndexes(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const maxLengthForPage = 1000
    for (let i = 0; i < idsToPurge.length; i += maxLengthForPage) {
      const idsSubset = idsToPurge.slice(i, i + maxLengthForPage)
      const query = `ListingKey:(${idsSubset.join(' OR ')})`
      await promisify(solrClient.deleteByQuery.bind(solrClient))(query)
    }
    await promisify(solrClient.commit.bind(solrClient))()
    // TODO: I should handle the 'purgeFromParent' situation here. See the MySQL data adapter as an example.
    // I'm not doing it now to save time because I don't need it for my current use case.
  }

  async function closeConnection() {
    // Reminder: we are creating solrClient objects in various methods. I'm not aware of a close method at all actually.
    // But if there is one, we could close the connection in each of those methods. Alternatively, we could add each
    // solrClient object to a WeakMap and then close them all here.
  }

  // "Missing IDs data" means that the goal is to understand which records are not up to date in a reconcile process.
  // So to do that, we look at fields like ModificationTimestamp, PhotosChangeTimestamp, etc. It's those multiple fields
  // that we look at that I'm calling the "data".
  async function fetchMissingIdsData(mlsResourceName, indexes) {
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes)
    const solrTimestampFieldNames = timestampFieldNames.map(x => makeFieldName(mlsResourceName, x))
    const fieldNamesSolr = [userFieldName, ...solrTimestampFieldNames]
    const solrClient = makeSolrClient(mlsResourceName)
    const count = await _getCount(solrClient)
    const query = solrClient.createQuery()
      .q('*:*')
      .fl(fieldNamesSolr)
      .rows(count)
    const results = await promisify(solrClient.search.bind(solrClient))(query)
    return results.response.docs
  }

  function computeMissingIds(mlsResourceName, dataInMls, dataInAdapter, indexes) {
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes)
    const solrTimestampFieldNames = timestampFieldNames.map(x => makeFieldName(mlsResourceName, x))
    const workerPath = pathLib.resolve(__dirname, '../worker.js')
    const worker = new Worker(workerPath)
    return new Promise((resolve, reject) => {
      worker.on('message', missingOrOldIds => {
        resolve(missingOrOldIds)
      })
      worker.postMessage({
        dataInAdapter,
        userFieldName,
        dataInMls,
        officialFieldName,
        timestampFieldNames,
        solrTimestampFieldNames,
      })
    })
  }

  return {
    syncStructure,
    syncData,
    getTimestamps,
    closeConnection,
    setPlatformAdapter,
    setPlatformDataAdapter,
    getAllIds,
    purge,
    getCount,
    getMostRecentTimestamp,
    fetchMissingIdsData,
    computeMissingIds,
  }
}
