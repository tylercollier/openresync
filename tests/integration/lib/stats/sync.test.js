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

    // Listen to the done event, and wait a short amount of time
    // in which we expect our stats sync to the db to be done. Seems to work great.
    const p = new Promise(resolve => {
      eventEmitter.on('ors:sync.done', () => setTimeout(resolve, 100))
    })

    await destinationManager.resumeSync()

    await p

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
    const syncResourcesRecord1 = rows[0]
    expect(rows[1].name).toEqual('Member')
    expect(rows[1].is_done).toEqual(1)
    const syncResourcesRecord2 = rows[1]

    rows = await db.select('*').from(makeTableName('sync_destinations'))
    expect(rows).toHaveLength(2)
    expect(rows[0].sync_resources_id).toEqual(syncResourcesRecord1.id)
    expect(rows[0].name).toEqual('my_destination')
    expect(rows[0].is_done).toEqual(1)
    expect(rows[1].sync_resources_id).toEqual(syncResourcesRecord2.id)
    expect(rows[1].name).toEqual('my_destination')
    expect(rows[1].is_done).toEqual(1)
  })
})
