const { makeTableName } = require('./setUp')

const ORS_SYNC_START = 'ors:sync.start'
const ORS_SYNC_DONE = 'ors:sync.done'
const ORS_SYNC_ERROR = 'ors:sync.error'
const ORS_SYNC_RESOURCE_START = 'ors:sync.resource.start'
const ORS_SYNC_RESOURCE_DONE = 'ors:sync.resource.done'
const ORS_SYNC_DESTINATION_PAGE = 'ors:sync.destination.page'

module.exports = function(db) {
  const getLastInsertId = trx => () => trx.raw(`SELECT LAST_INSERT_ID()`)
    .then(([rows]) => rows[0]['LAST_INSERT_ID()'])

  function runDbInsertAndGetLastInsertId(fn) {
    return new Promise(resolve => {
      db.transaction(trx => {
        return fn(trx)
          .then(getLastInsertId(trx))
          .then(resolve)
      })
    })
  }

  function syncSourceStart({ mlsSourceName, batchId }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('sync_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function syncResourceStart(syncSourceId, { mlsResourceObj }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('sync_resources')).insert({
        sync_sources_id: syncSourceId,
        name: mlsResourceObj.name,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function syncDestinationPage(syncResourceId, { destination, recordsSyncedCount }) {
    return db.table(makeTableName('sync_destinations'))
      .insert({
        sync_resources_id: syncResourceId,
        name: destination.name,
        num_records_synced: recordsSyncedCount,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict(['num_records_synced', 'updated_at'])
      .merge({
        num_records_synced: db.raw('num_records_synced + ?', [recordsSyncedCount]),
      })
      .then()
  }

  function syncResourceDone(syncResourceId) {
    return db.table(makeTableName('sync_resources'))
      .where('id', syncResourceId)
      .update({
        is_done: true,
        updated_at: db.fn.now(),
      })
      .then()
  }

  function syncSourceDone(syncSourceId) {
    return db.table(makeTableName('sync_sources'))
      .where('id', syncSourceId)
      .update({
        result: 'success',
        updated_at: db.fn.now(),
      })
      .then()
  }

  function syncSourceError(syncSourceId, e) {
    if (!syncSourceId) {
      return
    }
    return db.table(makeTableName('sync_sources'))
      .where('id', syncSourceId)
      .update({
        result: 'error',
        error: e.message,
        updated_at: db.fn.now(),
      })
      .then()
  }

  function listen(eventEmitter) {
    const ee = eventEmitter
    const queue = []
    let r
    let p = new Promise(resolve => {
      r = resolve
    })

    function stuffit(eventName) {
      return function(...args) {
        const val = {
          eventName,
          args,
        }
        queue.push(val)
        r()
      }
    }

    ee.on(ORS_SYNC_START, stuffit(ORS_SYNC_START))
    ee.on(ORS_SYNC_DONE, stuffit(ORS_SYNC_DONE))
    ee.on(ORS_SYNC_ERROR, stuffit(ORS_SYNC_ERROR))
    ee.on(ORS_SYNC_RESOURCE_START, stuffit(ORS_SYNC_RESOURCE_START))
    ee.on(ORS_SYNC_RESOURCE_DONE, stuffit(ORS_SYNC_RESOURCE_DONE))
    ee.on(ORS_SYNC_DESTINATION_PAGE, stuffit(ORS_SYNC_DESTINATION_PAGE))

    async function* generator() {
      while (true) {
        let x
        if (queue.length) {
          x = queue.shift()
        } else {
          p = new Promise(resolve => {
            r = resolve
          })
          await p
          continue
        }
        yield x
      }
    }

    (async () => {
      let syncSourceId
      let syncResourceId

      for await (const { eventName, args } of generator()) {
        if (eventName === ORS_SYNC_START) {
          syncSourceId = await syncSourceStart(...args)
        } else if (eventName === ORS_SYNC_DONE) {
          await syncSourceDone(syncSourceId)
        } else if (eventName === ORS_SYNC_ERROR) {
          await syncSourceError(syncSourceId, ...args)
        } else if (eventName === ORS_SYNC_RESOURCE_START) {
          syncResourceId = await syncResourceStart(syncSourceId, ...args)
        } else if (eventName === ORS_SYNC_RESOURCE_DONE) {
          await syncResourceDone(syncResourceId)
        } else if (eventName === ORS_SYNC_DESTINATION_PAGE) {
          await syncDestinationPage(syncResourceId, ...args)
        } else {
          throw new Error(`Unknown event name: ${eventName}`)
        }
      }
    })()
  }

  return {
    listen,
  }
}
