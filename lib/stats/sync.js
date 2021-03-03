const { makeTableName } = require('./setUp')

const ORS_SYNC_START = 'ors:sync.start'
const ORS_SYNC_DONE = 'ors:sync.done'
const ORS_SYNC_RESOURCE_START = 'ors:sync.resource.start'
const ORS_SYNC_DESTINATION_START = 'ors:sync.destination.start'

module.exports = function(db) {
  const getLastInsertId = trx => () => trx.raw(`SELECT LAST_INSERT_ID()`)
    .then(([rows]) => rows[0]['LAST_INSERT_ID()'])

  function runDbInsertAndGetLastInsertId(fn) {
    return new Promise(resolve => {
      db.transaction(trx => {
        fn(trx)
          .then(getLastInsertId(trx))
          .then(resolve)
      })
    })
  }

  function syncStart({ mlsSourceName, batchId }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('sync_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
        created_at: trx.fn.now(),
      })
    })
  }

  function syncResourceStart(syncSourceId, { mlsResourceObj }) {
    console.log('syncSourceId', syncSourceId)
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('sync_resources')).insert({
        sync_sources_id: syncSourceId,
        name: mlsResourceObj.name,
        created_at: trx.fn.now(),
      })
    })
  }

  function syncDestinationStart(syncResourceId, { destination }) {
    console.log('syncResourceIdA', syncResourceId)
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('sync_destinations')).insert({
        sync_resources_id: syncResourceId,
        name: destination.name,
        created_at: trx.fn.now(),
      })
    })
  }

  // function syncDestinationDone({ destination }) {
  //   syncDestinationIdPromise.then(syncDestinationId => {
  //     return db.table(makeTableName('sync_destinations'))
  //       .where('id', syncDestinationId)
  //       .update({
  //         is_done: true,
  //         updated_at: db.fn.now(),
  //       })
  //       .then()
  //   })
  // }
  //
  // function syncResourceDone({ mlsResourceObj }) {
  //   syncResourceIdPromise.then(syncResourceId => {
  //     console.log('syncResourceIdB', syncResourceId)
  //     return db.table(makeTableName('sync_resources'))
  //       .where('id', syncResourceId)
  //       .update({
  //         is_done: true,
  //         updated_at: db.fn.now(),
  //       })
  //       .then()
  //   })
  // }
  //
  // function syncDone({ mlsSourceName, batchId }) {
  //   syncSourceIdPromise.then(syncSourceId => {
  //     return db.table(makeTableName('sync_sources'))
  //       .where('id', syncSourceId)
  //       .update({
  //         is_done: true,
  //         updated_at: db.fn.now(),
  //       })
  //       .then()
  //   })
  // }

  function listen(eventEmitter) {
    const ee = eventEmitter
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
        r({
          done: eventName === ORS_SYNC_DONE,
          val,
        })
      }
    }

    ee.on(ORS_SYNC_START, stuffit(ORS_SYNC_START))
    ee.on(ORS_SYNC_RESOURCE_START, stuffit(ORS_SYNC_RESOURCE_START))
    ee.on(ORS_SYNC_DESTINATION_START, stuffit(ORS_SYNC_DESTINATION_START))

    async function* generator() {
      while (true) {
        const x = await p
        console.log('here3')
        console.log('x', x)
        if (x.done) {
          console.log('here done')
          break
        }
        p = new Promise(resolve => {
          r = resolve
        })
        yield x.val
        console.log('after yield')
      }
    }

    (async () => {
      let syncSourceId
      let syncResourceId
      let syncDestinationId

      for await (const { eventName, args } of generator()) {
        if (eventName === ORS_SYNC_START) {
          console.log('here1')
          syncSourceId = await syncStart(...args)
          console.log('syncSourceId after await', syncSourceId)
        } else if (eventName === ORS_SYNC_RESOURCE_START) {
          console.log('here2')
          syncResourceId = await syncResourceStart(syncSourceId, ...args)
          console.log('syncResourceId after await', syncResourceId)
        } else if (eventName === ORS_SYNC_DESTINATION_START) {
          syncDestinationId = await syncDestinationStart(syncResourceId, ...args)
        }
      }
      console.log('here after for loop')
    })()
  }

  return {
    listen,
  }
}
