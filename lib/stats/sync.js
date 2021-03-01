const { makeTableName } = require('./setUp')

module.exports = function(db) {
  let syncSourceIdPromise
  let syncResourceIdPromise
  let syncDestinationIdPromise

  const getLastInsertId = trx => () => trx.raw(`SELECT LAST_INSERT_ID()`)
    .then(([rows]) => rows[0]['LAST_INSERT_ID()'])

  function syncStart({ mlsSourceName, batchId }) {
    syncSourceIdPromise = db.transaction(trx => {
      return db.table(makeTableName('sync_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
        created_at: db.fn.now(),
      })
        // I was going to use this to prove my way of doing it wouldn't work,
        // but it's not even needed. Often, but not always, the second ors_sync_destinations record's
        // sync_resources_id is 0, even without this timeout.
        // I think the 0 is because some other statement is run in between the insert and the
        // select last_insert_id().
        // UPDATE: Ok I've added a transaction around the inserts and the
        // SELECT LAST_INSERT_ID() and can see the sync_resources_id changes between the
        // syncDestinationStart and syncDestinationDone. So that proves that this won't work.
        // .then(new Promise(resolve => setTimeout(resolve, 1000)))
        .then(getLastInsertId(trx))
    })
  }

  function syncResourceStart({ mlsResourceObj }) {
    syncResourceIdPromise = db.transaction(trx => {
      return syncSourceIdPromise.then(syncSourceId => {
        return trx.table(makeTableName('sync_resources')).insert({
          sync_sources_id: syncSourceId,
          name: mlsResourceObj.name,
          created_at: trx.fn.now(),
        })
          .then(getLastInsertId(trx))
      })
    })
  }

  function syncDestinationStart({ destination }) {
    syncDestinationIdPromise = db.transaction(trx => {
      return syncResourceIdPromise.then(syncResourceId => {
        console.log('syncResourceIdA', syncResourceId)
        return trx.table(makeTableName('sync_destinations')).insert({
          sync_resources_id: syncResourceId,
          name: destination.name,
          created_at: trx.fn.now(),
        })
          .then(getLastInsertId(trx))
      })
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
      console.log('syncResourceIdB', syncResourceId)
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
      // Don't use .off() unless we're going to turn it back on.
      // This is part of my proof that doing it this way won't work. We need to create closures.
      // ee.off('ors:sync.destination.start', syncDestinationStart)
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
