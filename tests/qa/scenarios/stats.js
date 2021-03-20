const config = require('../../../lib/config')
const { SyncSource } = require('../../../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../../../lib/stats/setUp')
const { createQaDb } = require('../../lib/db')
const { syncSourceDataSet1 } = require('../../fixtures/syncStats')

async function go() {
  const db = await createQaDb()
  Model.knex(db)

  try {
    await setUp(db)

    await SyncSource.query().insertGraphAndFetch(syncSourceDataSet1)
  } catch (error) {
    db.destroy()
    throw error
  }
  console.log('Done setting up scenario')
}

module.exports = go
