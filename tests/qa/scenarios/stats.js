const config = require('../../../lib/config')
const { SyncSource } = require('../../../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../../../lib/stats/setUp')
const { createRandomTestDb, createQaDb } = require('../../lib/db')

async function go(input, options = { useQaDb: true }) {
  let db
  if (options.useQaDb) {
    db = await createQaDb()
  } else {
    db = await createRandomTestDb()
  }
  Model.knex(db)

  try {
    await setUp(db)

    return await SyncSource.query().insertGraphAndFetch(input)
  } catch (error) {
    db.destroy()
    throw error
  }
}

module.exports = go
