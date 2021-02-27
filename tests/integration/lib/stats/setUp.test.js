const knex = require('knex')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')

describe('setUp', () => {
  let db
  const testDbName = 'mymls_test'
  const connectionString = `mysql://user1:password1@localhost:33033/${testDbName}`

  beforeAll(() => {
    db = knex({
      client: 'mysql2',
      connection: connectionString,
    })
  })

  afterAll(() => {
    db.destroy()
  })

  beforeEach(async () => {
    for (const name of ['sync_sources', 'sync_resources', 'sync_destinations']) {
      await db.schema.dropTableIfExists(makeTableName(name))
    }
  })

  test('creates tables', async () => {
    await setUp({ connectionString })
    expect(await db.schema.hasTable(makeTableName('sync_sources'))).toEqual(true)
    expect(await db.schema.hasTable(makeTableName('sync_resources'))).toEqual(true)
    expect(await db.schema.hasTable(makeTableName('sync_destinations'))).toEqual(true)
    // const columnInfo = await db.table(makeTableName('sync_sources')).columnInfo()
    // console.log('columnInfo', columnInfo)
    // const [rows] = await db.raw(`SHOW INDEX FROM ${makeTableName('sync_sources')}`)
    // console.log('rows', rows)
  })
})