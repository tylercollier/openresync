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
    for (const mlsResourceName of ['Property', 'Media']) {
      await db.schema.dropTableIfExists(mlsResourceName)
    }
  })

  describe('effectNewTable', () => {
    describe('without expand', () => {
      const mlsResource = {
        name: 'Property',
      }

      test('nested tables are not created', async () => {
        const dataAdapter = buildDataAdapter({
          destinationConfig,
          platformAdapterName,
        })
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
        const dataAdapter = buildDataAdapter({
          destinationConfig,
          platformAdapterName,
        })
        await dataAdapter.syncStructure(mlsResource, metadata)
        await expect(db.schema.hasTable('Property')).resolves.toEqual(true)
        await expect(db.schema.hasTable('Media')).resolves.toEqual(true)
      })
    })
  })
})
