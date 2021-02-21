const knex = require('knex')
const mysqlDataAdapter = require('../../../../../lib/sync/dataAdapters/mysql')
const { buildDataAdapter } = require('../../../../../lib/sync/dataAdapters/index')
const { getIndexes } = require('../../../../../lib/sync/indexes')
const { getBridgeMetadata } = require('../../../../fixtures/index')
const biPlatformAdapter = require('../../../../../lib/sync/platformAdapters/bridgeInteractive')

describe('sync structure', () => {
  const mlsSourceName = 'myMlsSource'
  const platformAdapterName = 'bridgeInteractive'
  const testDbName = 'mymls_test'
  const destinationConfig = {
    name: 'mysqlTest',
    type: 'mysql',
    config: {
      connectionString: `mysql://user1:password1@localhost:33033/${testDbName}`,
    },
  }
  let db
  let metadata

  beforeAll(async () => {
    db = knex({
      client: 'mysql2',
      connection: destinationConfig.config.connectionString,
    })
    metadata = await getBridgeMetadata()
    const platformAdapter = biPlatformAdapter()
  })

  afterAll(() => {
    db.destroy()
  })

  beforeEach(async () => {
    for (const mlsResourceName of ['Property', 'Media', 'Member']) {
      await db.schema.dropTableIfExists(mlsResourceName)
    }
  })

  describe('syncStructure', () => {
    let dataAdapter

    beforeEach(() => {
      dataAdapter = buildDataAdapter({
        destinationConfig,
        platformAdapterName,
      })
    })

    afterEach(() => {
      dataAdapter.closeConnection()
    })

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
          selectFn: fieldName => ['ListingKey', 'ListingKeyNumeric', 'ListPrice'].includes(fieldName),
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
          selectFn: fieldName => ['ListingKey', 'ListingKeyNumeric', 'ListPrice'].includes(fieldName),
          expand: [
            {
              name: 'Member',
              selectFn: fieldName => ['MemberKey', 'MemberKeyNumeric', 'MemberCity'].includes(fieldName),
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
})
