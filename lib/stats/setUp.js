const knex = require('knex')

async function setUp(db) {
  await createTables()

  async function createTables() {
    await db.schema.createTable(makeTableName('sync_sources'), table => {
      table.increments()
      table.string('name').notNullable()
      table.string('batch_id').notNullable()
      table.string('result')
      table.string('error')
      table.timestamps()

      table.index(['name'])
      table.index(['batch_id'])
      table.index(['result'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('sync_resources'), table => {
      table.increments()
      table.integer('sync_sources_id').notNullable()
      table.string('name').notNullable()
      table.boolean('is_done').notNullable().defaultTo(false)
      table.timestamps()

      table.unique(['sync_sources_id', 'name'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('sync_destinations'), table => {
      table.increments()
      table.integer('sync_resources_id').notNullable()
      table.string('name').notNullable()
      table.integer('num_records_synced').notNullable().defaultTo(0)
      table.timestamps()

      table.unique(['sync_resources_id', 'name'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('purge_sources'), table => {
      table.increments()
      table.string('name').notNullable()
      table.string('batch_id').notNullable()
      table.string('result')
      table.string('error')
      table.timestamps()

      table.index(['name'])
      table.index(['batch_id'])
      table.index(['result'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('purge_resources'), table => {
      table.increments()
      table.integer('purge_sources_id').notNullable()
      table.string('name').notNullable()
      table.boolean('is_done').notNullable().defaultTo(false)
      table.timestamps()

      table.unique(['purge_sources_id', 'name'])
      table.index(['created_at'])
      table.index(['updated_at'])
    })

    await db.schema.createTable(makeTableName('purge_destinations'), table => {
      table.increments()
      table.integer('purge_resources_id').notNullable()
      table.string('name').notNullable()
      table.integer('num_records_purged').notNullable().defaultTo(0)
      table.json('ids_purged').notNullable()
      table.timestamps()

      table.unique(['purge_resources_id', 'name'])
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
