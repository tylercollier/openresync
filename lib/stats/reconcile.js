const { makeTableName } = require('./setUp')
const {
  ORS_RECONCILE_START,
  ORS_RECONCILE_DONE,
  ORS_RECONCILE_ERROR,
  ORS_RECONCILE_RESOURCE_START,
  ORS_RECONCILE_RESOURCE_DONE,
  ORS_RECONCILE_DESTINATION_PAGE,
} = require('../eventNames')

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

  function reconcileSourceStart({ mlsSourceName, batchId }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('reconcile_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function reconcileResourceStart(reconcileSourceId, { mlsResourceObj }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('reconcile_resources')).insert({
        reconcile_sources_id: reconcileSourceId,
        name: mlsResourceObj.name,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function reconcileDestinationPage(reconcileResourceId, { destination, recordsSyncedCount }) {
    return db.table(makeTableName('reconcile_destinations'))
      .insert({
        reconcile_resources_id: reconcileResourceId,
        name: destination.name,
        num_records_reconciled: recordsSyncedCount,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict(['num_records_reconciled', 'updated_at'])
      .merge({
        num_records_reconciled: db.raw('num_records_reconciled + ?', [recordsSyncedCount]),
      })
      .then()
  }

  function reconcileResourceDone(reconcileResourceId) {
    return db.table(makeTableName('reconcile_resources'))
      .where('id', reconcileResourceId)
      .update({
        is_done: true,
        updated_at: db.fn.now(),
      })
      .then()
  }

  function reconcileSourceDone(reconcileSourceId) {
    return db.table(makeTableName('reconcile_sources'))
      .where('id', reconcileSourceId)
      .update({
        result: 'success',
        updated_at: db.fn.now(),
      })
      .then()
  }

  function reconcileSourceError(reconcileSourceId, e) {
    if (!reconcileSourceId) {
      return
    }
    return db.table(makeTableName('reconcile_sources'))
      .where('id', reconcileSourceId)
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
    let onEmptyQueuePromiseResolve
    let onEmptyQueuePromise = new Promise(resolve => {
      onEmptyQueuePromiseResolve = resolve
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

    ee.on(ORS_RECONCILE_START, stuffit(ORS_RECONCILE_START))
    ee.on(ORS_RECONCILE_DONE, stuffit(ORS_RECONCILE_DONE))
    ee.on(ORS_RECONCILE_ERROR, stuffit(ORS_RECONCILE_ERROR))
    ee.on(ORS_RECONCILE_RESOURCE_START, stuffit(ORS_RECONCILE_RESOURCE_START))
    ee.on(ORS_RECONCILE_RESOURCE_DONE, stuffit(ORS_RECONCILE_RESOURCE_DONE))
    ee.on(ORS_RECONCILE_DESTINATION_PAGE, stuffit(ORS_RECONCILE_DESTINATION_PAGE))

    async function* generator() {
      while (true) {
        let x
        if (queue.length) {
          x = queue.shift()
        } else {
          onEmptyQueuePromiseResolve()
          p = new Promise(resolve => {
            r = resolve
          })
          await p
          onEmptyQueuePromise = new Promise(resolve => {
            onEmptyQueuePromiseResolve = resolve
          })
          continue
        }
        yield x
      }
    }

    (async () => {
      let reconcileSourceId
      let reconcileResourceId

      for await (const { eventName, args } of generator()) {
        if (eventName === ORS_RECONCILE_START) {
          reconcileSourceId = await reconcileSourceStart(...args)
        } else if (eventName === ORS_RECONCILE_DONE) {
          await reconcileSourceDone(reconcileSourceId)
        } else if (eventName === ORS_RECONCILE_ERROR) {
          await reconcileSourceError(reconcileSourceId, ...args)
        } else if (eventName === ORS_RECONCILE_RESOURCE_START) {
          reconcileResourceId = await reconcileResourceStart(reconcileSourceId, ...args)
        } else if (eventName === ORS_RECONCILE_RESOURCE_DONE) {
          await reconcileResourceDone(reconcileResourceId)
        } else if (eventName === ORS_RECONCILE_DESTINATION_PAGE) {
          await reconcileDestinationPage(reconcileResourceId, ...args)
        } else {
          throw new Error(`Unknown event name: ${eventName}`)
        }
      }
    })()

    function onEmptyQueue() {
      return onEmptyQueuePromise
    }

    return {
      onEmptyQueue
    }
  }

  return {
    listen,
  }
}
