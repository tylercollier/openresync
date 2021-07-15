const _ = require('lodash')
const moment = require('moment')
const solr = require('solr-client')
const { getPrimaryKeyField, getTimestampFields } = require('../utils')
const { getIndexes } = require('../indexes')
const promisify = require('util').promisify

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
    // Do nothing
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
    const cache = {}
    const documents = mlsData.map(x => transform(mlsResourceObj.name, x, metadata, cache))
    await promisify(solrClient.add.bind(solrClient))(documents)
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

  async function getMissingIds(mlsResourceName, dataInMls, indexes) {
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
    const dataInMlsObj = dataInMls.reduce((a, v) => {
      a[v[officialFieldName]] = v
      return a
    }, {})
    const docsObj = results.response.docs.reduce((a, v) => {
      a[v[userFieldName]] = v
      return a
    }, {})
    const missingOrOldObjs = dataInMls.reduce((a, v, index) => {
      const id = v[officialFieldName]
      const solrObj = docsObj[id]
      if (solrObj) {
        for (let i = 0; i < timestampFieldNames.length; i++) {
          // Remember, the fields might not even exist on the Solr object.
          if (!v[timestampFieldNames[i]] && !solrObj[solrTimestampFieldNames[i]]) {
            continue
          }
          const mlsVal = moment.utc(v[timestampFieldNames[i]])
            // TODO: the dates I currently have in Solr don't have milliseconds, so remove them from the dates in the
            // MLS for comparison's sake. Do I want them in Solr with milliseconds, or without for parity with MySQL?
            .milliseconds(0)
          const solrVal = moment.utc(solrObj[solrTimestampFieldNames[i]])
          if (!mlsVal.isSame(solrVal)) {
            a.push(v)
            break
          }
        }
      } else {
        a.push(v)
      }
      return a
    }, [])

    const missingOrOldIds = missingOrOldObjs.map(x => x[officialFieldName])
    return missingOrOldIds
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
    getMissingIds,
  }
}
