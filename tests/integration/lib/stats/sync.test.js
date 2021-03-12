const { mockFs, restoreFs } = require('../../../lib/mock-fs')
const destinationManagerLib = require('../../../../lib/sync/destinationManager')
const pino = require('pino')
const EventEmitter = require('events')
const { setUp, makeTableName } = require('../../../../lib/stats/setUp')
const { createRandomTestDb, dropAndDestroyTestDb } = require('../../../lib/db')
const moment = require('moment')
const { Model } = require('objection')

const statsSyncLib = require('../../../../lib/stats/sync')

describe('stats/sync', () => {
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
    for (const name of ['sync_sources', 'sync_resources', 'sync_destinations']) {
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
        ListingId: 'listing2',
      }],
    })
    const fileContentsMember = JSON.stringify({
      '@odata.count': 1,
      value: [{
        MemberId: 'member1',
      }],
    })
    mockFs({
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsProperty1,
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Property/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-44-000Z.json': fileContentsProperty2,
      '/home/tylercollier/repos/openresync/config/sources/myMlsSource/downloadedData/Member/sync_batch_2021-02-18-T-06-24-07-623Z_seq_2021-02-20-T-05-21-43-176Z.json': fileContentsMember,
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
      expect(rows[0].result).toEqual('success')
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
      expect(rows[0].num_records_synced).toEqual(2)
      expect(rows[1].sync_resources_id).toEqual(syncResourcesRecord2.id)
      expect(rows[1].name).toEqual('my_destination')
      expect(rows[1].num_records_synced).toEqual(1)

      Model.knex(db)
      class SyncSource extends Model {
        static get tableName() {
          return 'ors_sync_sources'
        }

        static get relationMappings() {
          return {
            resources: {
              relation: Model.HasManyRelation,
              modelClass: SyncResource,
              join: {
                from: 'ors_sync_sources.id',
                to: 'ors_sync_resources.sync_sources_id',
              },
            },
          }
        }
      }
      class SyncResource extends Model {
        static get tableName() {
          return 'ors_sync_resources'
        }

        static get relationMappings() {
          return {
            source: {
              relation: Model.BelongsToOneRelation,
              modelClass: SyncSource,
              join: {
                from: 'ors_sync_resources.sync_sources_id',
                to: 'ors_sync_sources.id',
              },
            },
            destinations: {
              relation: Model.HasManyRelation,
              modelClass: SyncDestination,
              join: {
                from: 'ors_sync_resources.id',
                to: 'ors_sync_destinations.sync_resources_id',
              },
            },
          }
        }
      }
      class SyncDestination extends Model {
        static get tableName() {
          return 'ors_sync_destinations'
        }

        static get relationMappings() {
          return {
            resource: {
              relation: Model.BelongsToOneRelation,
              modelClass: SyncResource,
              join: {
                from: 'ors_sync_destinations.sync_resources_id',
                to: 'ors_sync_resources.id',
              },
            },
          }
        }
      }

      const stats = await SyncSource.query()
        // .withGraphFetched('[resources, resources.destinations]')
        .withGraphFetched({
          resources: {
            destinations: true,
          },
        })
      console.log('something', JSON.stringify(stats, null, 2))

      // const getLastInsertId = trx => trx.raw(`SELECT LAST_INSERT_ID()`)
      //   .then(([rows]) => rows[0]['LAST_INSERT_ID()'])
      // await db.transaction(async trx => {
      //   await trx.table(makeTableName('sync_sources')).insert({
      //     name: 'sup',
      //     batch_id: 'xyz',
      //   })
      //   let id
      //   id = await getLastInsertId(trx)
      //   await trx.table(makeTableName('sync_resources')).insert({
      //     sync_sources_id: id,
      //     name: 'sup',
      //     is_done: true,
      //   })
      //   id = await getLastInsertId(trx)
      //   await trx.table(makeTableName('sync_destinations')).insert({
      //     sync_resources_id: id,
      //     name: 'sup',
      //     num_records_synced: 999,
      //   })
      // })
      // const x = await db(makeTableName('sync_sources'))
      //   .join(makeTableName('sync_resources'), `${makeTableName('sync_sources')}.id`, `${makeTableName('sync_resources')}.sync_sources_id`)
      //   .join(makeTableName('sync_destinations'), `${makeTableName('sync_resources')}.id`, `${makeTableName('sync_destinations')}.sync_resources_id`)
      //   .select('ors_sync_sources.*', 'ors_sync_resources.*', 'ors_sync_destinations.*')
      // console.log('x', x)
    })
  })

  describe('error', () => {
    beforeEach(() => {
      // Force an error to be thrown by an invalid currentFilePath.
      internalConfig = {
        sources: [{
          name: mlsSourceName,
          processSyncBatch: {
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
      const statsSync = statsSyncLib(db)
      statsSync.listen(eventEmitter)

      // Listen to the event, and wait a short amount of time
      // in which we expect our stats sync to the db to be done. Seems to work great.
      const p = new Promise(resolve => {
        eventEmitter.on('ors:sync.error', () => setTimeout(resolve, 100))
      })

      try {
        await destinationManager.resumeSync()
      } catch (error) {}

      await p

      let rows

      rows = await db.select('*').from(makeTableName('sync_sources'))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toEqual('myMlsSource')
      expect(rows[0].batch_id).toEqual('2021-02-18-T-06-24-07-623Z')
      expect(rows[0].result).toEqual('error')
      expect(rows[0].result).not.toBe(null)
    })
  })
})
