const { makeTableName } = require('./setUp')

module.exports = function(db) {
  function listen(eventEmitter) {
    const ee = eventEmitter

    ee.on('ors:sync:start', async ({
      mlsSourceName,
      batchId,
    }) => {
      await db.table(makeTableName('sync_sources')).insert({
        name: mlsSourceName,
        batch_id: batchId,
      })
    })
  }

  return {
    listen,
  }
}
