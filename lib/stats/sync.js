const { makeTableName } = require('./setUp')

module.exports = function(db) {
  let syncSourceIdPromise
  let syncResourceIdPromise
  let syncDestinationIdPromise

  const getLastInsertId = () => db.raw(`SELECT LAST_INSERT_ID()`)
    .then(([rows]) => rows[0]['LAST_INSERT_ID()'])

  function syncStart({ mlsSourceName, batchId }) {
    syncSourceIdPromise = db.table(makeTableName('sync_sources')).insert({
      name: mlsSourceName,
      batch_id: batchId,
      created_at: db.fn.now(),
    })
      .then(getLastInsertId)
  }

  function syncResourceStart({ mlsResourceObj }) {
    syncResourceIdPromise = syncSourceIdPromise.then(syncSourceId => {
      return db.table(makeTableName('sync_resources')).insert({
        sync_sources_id: syncSourceId,
        name: mlsResourceObj.name,
        created_at: db.fn.now(),
      })
        .then(getLastInsertId)
    })
  }

  function syncDestinationStart({ destination }) {
    syncDestinationIdPromise = syncResourceIdPromise.then(syncResourceId => {
      return db.table(makeTableName('sync_destinations')).insert({
        sync_resources_id: syncResourceId,
        name: destination.name,
        created_at: db.fn.now(),
      })
        .then(getLastInsertId)
    })
  }

  function syncDestinationDone({ destination }) {
    syncDestinationIdPromise.then(syncDestinationId => {
      return db.table(makeTableName('sync_destinations'))
        .where('id', syncDestinationId)
        .update({
          is_done: true,
          updated_at: db.fn.now(),
        })
        .then()
    })
  }

  function syncResourceDone({ mlsResourceObj }) {
    syncResourceIdPromise.then(syncResourceId => {
      return db.table(makeTableName('sync_resources'))
        .where('id', syncResourceId)
        .update({
          is_done: true,
          updated_at: db.fn.now(),
        })
        .then()
    })
  }

  function syncDone({ mlsSourceName, batchId }) {
    syncSourceIdPromise.then(syncSourceId => {
      return db.table(makeTableName('sync_sources'))
        .where('id', syncSourceId)
        .update({
          is_done: true,
          updated_at: db.fn.now(),
        })
        .then()
    })
  }

  function listen(eventEmitter) {
    const ee = eventEmitter
    ee.on('ors:sync.start', syncStart)
    ee.on('ors:sync.resource.start', syncResourceStart)
    ee.on('ors:sync.destination.start', syncDestinationStart)
    ee.on('ors:sync.destination.done', syncDestinationDone)
    ee.on('ors:sync.resource.done', (...args) => {
      syncResourceDone(...args)
      ee.off('ors:sync.destination.start', syncDestinationStart)
    })
    ee.on('ors:sync.done', (...args) => {
      syncDone(...args)
      ee.off('ors:sync.resource.start', syncResourceStart)
    })
    // Alternative, 2 lines instead of 4
    // ee.on('ors:sync.done', syncDone)
    // ee.on('ors:sync.done', () => ee.off('ors:sync.resource.start', syncResourceStart))
  }

  return {
    listen,
  }
}
