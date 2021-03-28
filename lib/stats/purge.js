const { makeTableName } = require('./setUp')

const ORS_PURGE_START = 'ors:purge.start'
const ORS_PURGE_DONE = 'ors:purge.done'
const ORS_PURGE_ERROR = 'ors:purge.error'
const ORS_PURGE_RESOURCE_START = 'ors:purge.resource.start'
const ORS_PURGE_RESOURCE_DONE = 'ors:purge.resource.done'
const ORS_PURGE_DESTINATION_PAGE = 'ors:purge.destination.page'

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

  function purgeSourceStart({ mlsSourceName, batchId }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('purge_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function purgeResourceStart(purgeSourceId, { mlsResourceObj }) {
    return runDbInsertAndGetLastInsertId(trx => {
      return trx.table(makeTableName('purge_resources')).insert({
        purge_sources_id: purgeSourceId,
        name: mlsResourceObj.name,
        created_at: trx.fn.now(),
        updated_at: db.fn.now(),
      })
    })
  }

  function purgeDestinationPage(purgeResourceId, { destination, idsPurged }) {
    return db.table(makeTableName('purge_destinations'))
      .insert({
        purge_resources_id: purgeResourceId,
        name: destination.name,
        num_records_purged: idsPurged.length,
        ids_purged: JSON.stringify(idsPurged.slice(0, 1)),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
  }

  function purgeResourceDone(purgeResourceId) {
    return db.table(makeTableName('purge_resources'))
      .where('id', purgeResourceId)
      .update({
        is_done: true,
        updated_at: db.fn.now(),
      })
      .then()
  }

  function purgeSourceDone(purgeSourceId) {
    return db.table(makeTableName('purge_sources'))
      .where('id', purgeSourceId)
      .update({
        result: 'success',
        updated_at: db.fn.now(),
      })
      .then()
  }

  function purgeSourceError(purgeSourceId, e) {
    if (!purgeSourceId) {
      return
    }
    return db.table(makeTableName('purge_sources'))
      .where('id', purgeSourceId)
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

    ee.on(ORS_PURGE_START, stuffit(ORS_PURGE_START))
    ee.on(ORS_PURGE_DONE, stuffit(ORS_PURGE_DONE))
    ee.on(ORS_PURGE_ERROR, stuffit(ORS_PURGE_ERROR))
    ee.on(ORS_PURGE_RESOURCE_START, stuffit(ORS_PURGE_RESOURCE_START))
    ee.on(ORS_PURGE_RESOURCE_DONE, stuffit(ORS_PURGE_RESOURCE_DONE))
    ee.on(ORS_PURGE_DESTINATION_PAGE, stuffit(ORS_PURGE_DESTINATION_PAGE))

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
        if (x.eventName === ORS_PURGE_DONE) {
          break
        }
      }
    }

    (async () => {
      let purgeSourceId
      let purgeResourceId

      for await (const { eventName, args } of generator()) {
        if (eventName === ORS_PURGE_START) {
          purgeSourceId = await purgeSourceStart(...args)
        } else if (eventName === ORS_PURGE_DONE) {
          await purgeSourceDone(purgeSourceId)
        } else if (eventName === ORS_PURGE_ERROR) {
          await purgeSourceError(purgeSourceId, ...args)
        } else if (eventName === ORS_PURGE_RESOURCE_START) {
          purgeResourceId = await purgeResourceStart(purgeSourceId, ...args)
        } else if (eventName === ORS_PURGE_RESOURCE_DONE) {
          await purgeResourceDone(purgeResourceId)
        } else if (eventName === ORS_PURGE_DESTINATION_PAGE) {
          await purgeDestinationPage(purgeResourceId, ...args)
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
