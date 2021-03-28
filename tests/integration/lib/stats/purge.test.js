const { mockFs, restoreFs } = require('../../../lib/mock-fs')
const destinationManagerLib = require('../../../../lib/sync/destinationManager')
const pino = require('pino')
const EventEmitter = require('events')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')
const { createRandomTestDb, dropAndDestroyTestDb } = require('../../../lib/db')
const moment = require('moment')
const statsPurgeLib = require('../../../../lib/stats/purge')

describe('stats/purge', () => {
  let db
  let destinationManager
  let testLogger
  let eventEmitter
  let internalConfig
  let configBundle

  const mlsSourceName = 'myMlsSource'
  const userConfig = {
    sources: [
      {
        name: 'myMlsSource',
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
    ],
  }
  const flushInternalConfig = () => {}

  beforeAll(async () => {
    db = await createRandomTestDb()
  })

  afterAll(async () => {
    await dropAndDestroyTestDb(db)
  })

  beforeEach(async () => {
    const tableNames = [
      'sync_sources',
      'sync_resources',
      'sync_destinations',
      'purge_sources',
      'purge_resources',
      'purge_destinations',
    ]
    for (const name of tableNames) {
      await db.schema.dropTableIfExists(makeTableName(name))
    }
    await setUp(db)
    testLogger = new pino({ level: 'silent' })
    eventEmitter = new EventEmitter()

    const fileContentsProperty1 = JSON.stringify({
      '@odata.count': 1,
      value: [{
        ListingId: 'listing1',
      }],
    })
    const fileContentsProperty2 = JSON.stringify({
      '@odata.count': 1,
      value: [{
        ListingId: 'listing3',
      }],
    })
    const fileContentsMember = JSON.stringify({
      '@odata.count': 1,
      value: [{
        MemberId: 'member1',
      }],
    })
    mockFs({
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/purge_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsProperty1,
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/purge_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-44-000Z.json': fileContentsProperty2,
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Member/purge_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsMember,
    })
  })

  afterEach(() => {
    restoreFs()
    destinationManager.closeConnections()
  })

  function doSharedSetup() {
    configBundle = { userConfig, internalConfig, flushInternalConfig }
    destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter, testLogger)
  }

  describe('success', () => {
    beforeEach(() => {
      internalConfig = {}
      doSharedSetup()
    })

    test('the event emitter emits and we listen and write to the database', async () => {
      const statsPurge = statsPurgeLib(db)
      statsPurge.listen(eventEmitter)

      // Listen to the done event, and wait a short amount of time
      // in which we expect our stats purge to the db to be done. Seems to work great.
      const p = new Promise(resolve => {
        eventEmitter.on('ors:purge.done', () => setTimeout(resolve, 100))
      })

      await destinationManager.resumePurge()

      await p

      let rows

      rows = await db.select('*').from(makeTableName('purge_sources'))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toEqual('myMlsSource')
      expect(rows[0].batch_id).toEqual('2021-02-18-T-06-24-07-623Z')
      expect(rows[0].result).toEqual('success')
      const purgeSourcesRecord = rows[0]

      rows = await db.select('*').from(makeTableName('purge_resources'))
      expect(rows).toHaveLength(2)
      expect(rows[0].purge_sources_id).toEqual(purgeSourcesRecord.id)
      expect(rows[0].name).toEqual('Property')
      expect(rows[0].is_done).toEqual(1)
      const purgeResourcesRecord1 = rows[0]
      expect(rows[1].name).toEqual('Member')
      expect(rows[1].is_done).toEqual(1)
      const purgeResourcesRecord2 = rows[1]

      rows = await db.select('*').from(makeTableName('purge_destinations'))
      expect(rows).toHaveLength(2)
      expect(rows[0].purge_resources_id).toEqual(purgeResourcesRecord1.id)
      expect(rows[0].name).toEqual('my_destination')
      // expect(rows[0].num_records_purged).toEqual(1)
      // expect(rows[0].ids_purged).toEqual([1])
      expect(rows[1].purge_resources_id).toEqual(purgeResourcesRecord2.id)
      expect(rows[1].name).toEqual('my_destination')
      // expect(rows[1].num_records_purged).toEqual(1)
      // expect(rows[1].ids_purged).toEqual([1])
    })
  })

  describe('error', () => {
    beforeEach(() => {
      // Force an error to be thrown by an invalid currentFilePath.
      internalConfig = {
        sources: [{
          name: mlsSourceName,
          processPurgeBatch: {
            batchTimestamp: '2021-02-18T06:24:07.623Z',
            mlsResourcesStatus: [
              {
                name: 'Property',
                currentFilePath: '/fake/file/path',
                done: false,
              },
            ],
          },
        }],
      }
      doSharedSetup()
    })

    test('captures errors', async () => {
      const statsPurge = statsPurgeLib(db)
      statsPurge.listen(eventEmitter)

      // Listen to the event, and wait a short amount of time
      // in which we expect our stats purge to the db to be done. Seems to work great.
      const p = new Promise(resolve => {
        eventEmitter.on('ors:purge.error', () => setTimeout(resolve, 100))
      })

      try {
        await destinationManager.resumePurge()
      } catch (error) {}

      await p

      let rows

      rows = await db.select('*').from(makeTableName('purge_sources'))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toEqual('myMlsSource')
      expect(rows[0].batch_id).toEqual('2021-02-18-T-06-24-07-623Z')
      expect(rows[0].result).toEqual('error')
      expect(rows[0].result).not.toBe(null)
    })
  })
})
