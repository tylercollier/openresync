global.console2 = global.console
const mockFs = require('mock-fs')
const destinationManagerLib = require('../../../../lib/sync/destinationManager')
const pino = require('pino')
const EventEmitter = require('events')
const knex = require('knex')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')

const statsSyncLib = require('../../../../lib/stats/sync')

describe('stats/sync', () => {
  let db
  let destinationManager
  let testLogger
  let eventEmitter

  const testDbName = 'mymls_test'
  const connectionString = `mysql://user1:password1@localhost:33033/${testDbName}`
  const mlsSourceName = 'myMlsSource'
  const platformAdapterName = 'bridgeInteractive'
  const userConfig = {
    sources: {
      myMlsSource: {
        platformAdapterName: 'bridgeInteractive',
        mlsResources: [
          {
            name: 'Property',
          },
        ],
        destinations: [],
      },
    },
  }
  const internalConfig = {}
  const flushInternalConfig = () => {}
  const configBundle = { userConfig, internalConfig, flushInternalConfig }

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
    await setUp(db)
    testLogger = new pino({ level: 'silent' })
    eventEmitter = new EventEmitter()

    const fileContents = JSON.stringify({
      '@odata.count': 1,
      value: [{
        ListingId: 'abc',
        ListingKey: 'abckey',
        ListingKeyNumeric: 123,
        PublicRemarks: 'It is a great house',
      }],
    })
    mockFs({
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContents,
    })

    destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter, testLogger)
  })

  afterEach(() => {
    mockFs.restore()
    eventEmitter.removeAllListeners()

    destinationManager.closeConnections()
  })

  test('stub fs', async () => {
    const statsSync = statsSyncLib(db)
    statsSync.listen(eventEmitter)
    await destinationManager.resumeSync()
    const rows = await db.select(['name', 'batch_id']).from(makeTableName('sync_sources'))

    // This timeout ensures we don't end the test before the event emitter callback is finished.
    // That event emitter callback uses the db object, so it makes sense if it'd behave weirdly
    // (crashes the test runner) if we kill the db connection while it's in use.
    // The odd thing is the following tests (database checks) (almost) always seem to pass,
    // so I wouldn't think that destroying the db connection would cause a problem. But it does.
    // My lesson learned here is that this isn't really a good idea for automated testing in
    // the traditional sense, and the way we're solving it makes the test slow. However,
    // overall it's better to have this automated test and easier than running it by hand,
    // so I should figure out how to categorize it into some batch so it's not lumped in
    // with other tests that are meant to be fast, but we can still get plenty of value out of it.
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(rows).toHaveLength(1)
    expect(rows[0].name).toEqual('myMlsSource')
    expect(rows[0].batch_id).toEqual('2021-02-18-T-06-24-07-623Z')
  })
})
