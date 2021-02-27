const { makeTableName } = require('./setUp')

module.exports = function(db) {
  const getLastInsertId = () => db.raw(`SELECT LAST_INSERT_ID()`)
    .then(([rows]) => rows[0]['LAST_INSERT_ID()'])

  function listen(eventEmitter) {
    const ee = eventEmitter

    ee.on('ors:sync.start', ({ mlsSourceName, batchId }) => {
      const syncSourceIdPromise = db.table(makeTableName('sync_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
      })
        .then(getLastInsertId)

      ee.on('ors:sync.resource.start', ({ mlsResourceObj }) => {
        const syncResourceIdPromise = new Promise(resolve => {
          syncSourceIdPromise.then(syncSourceId => {
            db.table(makeTableName('sync_resources')).insert({
              sync_sources_id: syncSourceId,
              name: mlsResourceObj.name,
            })
              .then(getLastInsertId)
              .then(resolve)
          })
        })

        ee.on('ors:sync.destination.start', ({ destination }) => {
          syncResourceIdPromise.then(syncResourceId => {
            db.table(makeTableName('sync_destinations')).insert({
              sync_resources_id: syncResourceId,
              name: destination.name,
            })
          })
        })

      })

    })
  }

  return {
    listen,
  }
}
