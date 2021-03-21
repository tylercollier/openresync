const { SyncSource } = require('../../../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../../../lib/stats/setUp')
const { createRandomTestDb } = require('../../../tests/lib/db')
const { syncSourceDataSet1 } = require('../../fixtures/syncStats')

async function go() {
  const db = await createRandomTestDb()
  Model.knex(db)

  try {
    await setUp(db)

    return await SyncSource.query().insertGraphAndFetch(syncSourceDataSet1)
  } catch (error) {
    db.destroy()
    throw error
  }
}

module.exports = go
