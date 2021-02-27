const knex = require('knex')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')
const crypto = require('crypto')

describe('setUp', () => {
  let db
  const testDbName = 'test_' + crypto.randomBytes(5).toString('hex')

  beforeAll(async () => {
    db = knex({
      client: 'mysql2',
      connection: `mysql://root:root@localhost:33033/`
    })
    await db.raw(`CREATE DATABASE ${testDbName}`)
    await db.raw(`GRANT ALL PRIVILEGES ON ${testDbName}.* TO user1`)
    db.destroy()
    db = knex({
      client: 'mysql2',
      connection: `mysql://user1:password1@localhost:33033/${testDbName}`
    })
  })

  afterAll(async () => {
    await db.raw(`DROP DATABASE ${testDbName}`)
    db.destroy()
  })

  beforeEach(async () => {
    for (const name of ['sync_sources', 'sync_resources', 'sync_destinations']) {
      await db.schema.dropTableIfExists(makeTableName(name))
    }
  })

  test('creates tables', async () => {
    await setUp(db)
    expect(await db.schema.hasTable(makeTableName('sync_sources'))).toEqual(true)
    expect(await db.schema.hasTable(makeTableName('sync_resources'))).toEqual(true)
    expect(await db.schema.hasTable(makeTableName('sync_destinations'))).toEqual(true)
    // const columnInfo = await db.table(makeTableName('sync_sources')).columnInfo()
    // console.log('columnInfo', columnInfo)
    // const [rows] = await db.raw(`SHOW INDEX FROM ${makeTableName('sync_sources')}`)
    // console.log('rows', rows)
  })
})