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
  let entityTypes

  beforeAll(async () => {
    db = knex({
      client: 'mysql2',
      connection: destinationConfig.config.connectionString,
    })
    const metadata = await getBridgeMetadata()
    const schemas = metadata['edmx:Edmx']['edmx:DataServices'][0].Schema
    const platformAdapter = biPlatformAdapter()
    entityTypes = platformAdapter.getEntityTypes(schemas)
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
      const mlsResources = [
        {
          name: 'Property',
        },
      ]
      test('nested tables are not created', async () => {
        const dataAdapter = buildDataAdapter({
          destinationConfig,
          platformAdapterName,
        })
        await dataAdapter.private.effectNewTable(mlsResources[0], entityTypes, getIndexes)
        await expect(db.schema.hasTable('Property')).resolves.toEqual(true)
        await expect(db.schema.hasTable('Media')).resolves.toEqual(false)
      })
    })

    describe('with expand', () => {
      const mlsResources = [
        {
          name: 'Property',
          expand: [
            {
              name: 'Media',
            },
          ],
        },
      ]
      test('nested tables are created', async () => {
        const dataAdapter = buildDataAdapter({
          destinationConfig,
          platformAdapterName,
        })
        await dataAdapter.private.effectNewTable(mlsResources[0], entityTypes, getIndexes)
        await expect(db.schema.hasTable('Property')).resolves.toEqual(true)
        await expect(db.schema.hasTable('Media')).resolves.toEqual(true)
      })
    })
  })
})
