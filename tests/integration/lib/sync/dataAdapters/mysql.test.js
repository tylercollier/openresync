const knex = require('knex')
const mysqlDataAdapter = require('../../../../../lib/sync/dataAdapters/mysql')
const { buildDataAdapter } = require('../../../../../lib/sync/dataAdapters/index')
const { getIndexes } = require('../../../../../lib/sync/indexes')
const { getBridgeMetadata } = require('../../../../fixtures/index')
const biPlatformAdapter = require('../../../../../lib/sync/platformAdapters/bridgeInteractive')
const { createRandomTestDb, dropAndDestroyTestDb } = require('../../../../lib/db')

describe('mysql data adapter', () => {
  const mlsSourceName = 'myMlsSource'
  const platformAdapterName = 'bridgeInteractive'
  let db
  let metadata

  beforeAll(async () => {
    db = await createRandomTestDb()
    metadata = await getBridgeMetadata()
    const platformAdapter = biPlatformAdapter()
  })

  afterAll(async () => {
    await dropAndDestroyTestDb(db)
  })

  beforeEach(async () => {
    for (const mlsResourceName of ['Property', 'Media', 'Member']) {
      await db.schema.dropTableIfExists(mlsResourceName)
    }
  })

  describe('some reusable block', () => {
    let dataAdapter

    beforeEach(async () => {
      const destinationConfig = {
        name: 'mysqlTest',
        type: 'mysql',
        config: {
          connectionString: `mysql://user1:password1@localhost:33033/${db.client.database()}`,
        },
      }
      dataAdapter = buildDataAdapter({
        destinationConfig,
        platformAdapterName,
      })
    })

    afterEach(() => {
      dataAdapter.closeConnection()
    })

    describe('syncStructure', () => {
      describe('without expand', () => {
        test('nested tables are not created', async () => {
          const mlsResource = {
            name: 'Property',
          }
          await dataAdapter.syncStructure(mlsResource, metadata)
          await expect(db.schema.hasTable('Property')).resolves.toEqual(true)
          await expect(db.schema.hasTable('Media')).resolves.toEqual(false)
        })
      })

      describe('with expand', () => {
        const mlsResource = {
          name: 'Property',
          expand: [
            {
              name: 'Media',
            },
          ],
        }
        test('nested tables are created', async () => {
          await dataAdapter.syncStructure(mlsResource, metadata)
          await expect(db.schema.hasTable('Property')).resolves.toEqual(true)
          await expect(db.schema.hasTable('Media')).resolves.toEqual(true)
        })
      })

      describe('without select', () => {
        test('all fields are created', async () => {
          const mlsResource = {
            name: 'Property',
          }
          await dataAdapter.syncStructure(mlsResource, metadata)
          const columnInfo = await db.table('Property').columnInfo()
          expect(Object.keys(columnInfo)).toHaveLength(187)
        })
      })

      describe('with select', () => {
        test('only selected subset of fields are created', async () => {
          const mlsResource = {
            name: 'Property',
            select: ['ListingKey', 'ListingKeyNumeric', 'ListPrice'],
          }
          await dataAdapter.syncStructure(mlsResource, metadata)
          const columnInfo = await db.table('Property').columnInfo()
          // 5 because ModificationTimestamp and PhotosChangeTimestamp are automatically included.
          expect(Object.keys(columnInfo)).toHaveLength(5)
        })
      })

      describe('with select and expand', () => {
        test('from each resource, only selected subset of fields are created', async () => {
          const mlsResource = {
            name: 'Property',
            select: ['ListingKey', 'ListingKeyNumeric', 'ListPrice'],
            expand: [
              {
                name: 'Member',
                select: ['MemberKey', 'MemberKeyNumeric', 'MemberCity'],
              },
              {
                name: 'Media',
              },
            ]
          }
          await dataAdapter.syncStructure(mlsResource, metadata)
          let columnInfo
          columnInfo = await db.table('Property').columnInfo()
          // 5 because ModificationTimestamp and PhotosChangeTimestamp are automatically included.
          expect(Object.keys(columnInfo)).toHaveLength(5)
          columnInfo = await db.table('Member').columnInfo()
          // 4 because ModificationTimestamp is automatically included.
          expect(Object.keys(columnInfo)).toHaveLength(4)
          columnInfo = await db.table('Media').columnInfo()
          expect(Object.keys(columnInfo)).toHaveLength(12)
        })
      })
    })

    describe('syncData', () => {
      describe('with select and expand', () => {
        test('from each resource, only selected subset of fields are synced', async () => {
          const mlsResource = {
            name: 'Property',
            select: ['ListingKey', 'ListingKeyNumeric', 'ListPrice'],
            expand: [
              {
                name: 'Member',
                fieldName: 'ListAgent',
                select: ['MemberKey', 'MemberKeyNumeric', 'MemberCity'],
              },
              {
                name: 'Media',
                fieldName: 'Media',
              },
            ]
          }
          await dataAdapter.syncStructure(mlsResource, metadata)
          const mlsData = [{
            ListingKey: 'abc',
            ListingKeyNumeric: 123,
            ListPrice: 500000,
            AboveGradeFinishedArea: 999,
            ListAgent: {
              MemberKey: 'def',
              MemberKeyNumeric: 456,
              MemberCity: 'Georgetown',
              MemberFirstname: 'George',
            },
            Media: [{
              MediaKey: 77,
              LongDescription: 'yaya',
            }],
          }]
          await dataAdapter.syncData(mlsResource, mlsData)
          let rows
          rows = await db.select('*').from('Property')
          expect(rows).toHaveLength(1)
          expect(rows[0].AboveGradeFinishedArea).toBeUndefined()
          rows = await db.select('*').from('Member')
          expect(rows).toHaveLength(1)
          expect(rows[0].MemberFirstName).toBeUndefined()
          rows = await db.select('*').from('Media')
          expect(rows).toHaveLength(1)
          expect(rows[0].LongDescription).toEqual('yaya')
        })
      })
    })
  })
})
