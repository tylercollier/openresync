const knex = require('knex')

async function setUp(db) {
  await createTables()

  async function createTables() {
    await db.schema.createTable(makeTableName('sync_sources'), table => {
      table.increments()
      table.string('name').notNullable()
      table.string('batch_id').notNullable()
      table.boolean('is_done').notNullable().defaultTo(false)
      table.dateTime('done_at')
      table.timestamps()

      table.index(['name'])
      table.index(['batch_id'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('sync_resources'), table => {
      table.increments()
      table.integer('sync_sources_id').notNullable()
      table.string('name').notNullable()
      table.boolean('is_done').notNullable().defaultTo(false)
      table.dateTime('done_at')
      table.timestamps()

      table.index(['sync_sources_id', 'name'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('sync_destinations'), table => {
      table.increments()
      table.integer('sync_resources_id').notNullable()
      table.string('name').notNullable()
      table.boolean('is_done').notNullable().defaultTo(false)
      table.dateTime('done_at')
      table.timestamps()

      table.index(['sync_resources_id', 'name'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })
  }
}

function makeTableName(name) {
  return `ors_${name}`
}

module.exports = {
  setUp,
  makeTableName,
}
