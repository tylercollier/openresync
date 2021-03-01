const { mockFs, restoreFs } = require('../../../lib/mock-fs')
const destinationManagerLib = require('../../../../lib/sync/destinationManager')
const pino = require('pino')
const EventEmitter = require('events')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')
const { createRandomTestDb, dropAndDestroyTestDb } = require('../../../lib/db')

const statsSyncLib = require('../../../../lib/stats/sync')

describe('stats/sync', () => {
  let db
  let destinationManager
  let testLogger
  let eventEmitter

  const mlsSourceName = 'myMlsSource'
  const userConfig = {
    sources: {
      myMlsSource: {
        platformAdapterName: 'bridgeInteractive',
        mlsResources: [
          {
            name: 'Property',
          },
          {
            name: 'Member',
          },
        ],
        destinations: [
          {
            name: 'my_destination',
            type: 'devnull',
          },
        ],
      },
    },
  }
  const internalConfig = {}
  const flushInternalConfig = () => {}
  const configBundle = { userConfig, internalConfig, flushInternalConfig }

  beforeAll(async () => {
    db = await createRandomTestDb()
  })

  afterAll(async () => {
    await dropAndDestroyTestDb(db)
  })

  beforeEach(async () => {
    for (const name of ['sync_sources', 'sync_resources', 'sync_destinations']) {
      await db.schema.dropTableIfExists(makeTableName(name))
    }
    await setUp(db)
    testLogger = new pino({ level: 'silent' })
    eventEmitter = new EventEmitter()

    const fileContentsProperty = JSON.stringify({
      '@odata.count': 1,
      value: [{
        ListingId: 'listing1',
      }],
    })
    const fileContentsMember = JSON.stringify({
      '@odata.count': 1,
      value: [{
        MemberId: 'member1',
      }],
    })
    mockFs({
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsProperty,
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Member/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsMember,
    })

    destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter, testLogger)
  })

  afterEach(() => {
    restoreFs()
    destinationManager.closeConnections()
  })

  test('the event emitter emits and we listen and write to the database', async () => {
    const statsSync = statsSyncLib(db)
    statsSync.listen(eventEmitter)
    await destinationManager.resumeSync()

    // This timeout ensures we don't end the test before the event emitter callback is finished.
    // That event emitter callback uses the db object, so it makes sense if it'd behave weirdly
    // (crashes the test runner) if we kill the db connection while it's in use.
    // The odd thing is the following tests (database checks) (almost) always seem to pass,
    // so I wouldn't think that destroying the db connection would cause a problem. But it does.
    //     Update: I question whether my tests were passing as only a day or two later did I write
    //             the code that would make the tests pass.
    // My lesson learned here is that this isn't really a good idea for automated testing in
    // the traditional sense, and the way we're solving it makes the test slow. However,
    // overall it's better to have this automated test and easier than running it by hand,
    // so I should figure out how to categorize it into some batch so it's not lumped in
    // with other tests that are meant to be fast, but we can still get plenty of value out of it.
    await new Promise(resolve => setTimeout(resolve, 2200))

    let rows

    rows = await db.select('*').from(makeTableName('sync_sources'))
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toEqual('myMlsSource')
    expect(rows[0].batch_id).toEqual('2021-02-18-T-06-24-07-623Z')
    expect(rows[0].is_done).toEqual(1)
    const syncSourcesRecord = rows[0]

    rows = await db.select('*').from(makeTableName('sync_resources'))
    expect(rows).toHaveLength(2)
    expect(rows[0].sync_sources_id).toEqual(syncSourcesRecord.id)
    expect(rows[0].name).toEqual('Property')
    expect(rows[0].is_done).toEqual(1)
    const syncResourcesRecord = rows[0]

    rows = await db.select('*').from(makeTableName('sync_destinations'))
    // I was using some number OTHER than 2 here so that Jest would show me the contents
    // of the array easily and I could see that the sync_resources_id of the second record was
    // not correct.
    expect(rows).toHaveLength(99)
    expect(rows[0].sync_resources_id).toEqual(syncResourcesRecord.id)
    expect(rows[0].name).toEqual('my_destination')
    expect(rows[0].is_done).toEqual(1)

    expect(rows[1].sync_resources_id).toEqual(2)
  })
})
