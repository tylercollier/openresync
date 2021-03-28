const { ApolloServer, gql, PubSub } = require('apollo-server')
const { buildUserConfig, getInternalConfig, flushInternalConfig, getMlsSourceUserConfig } = require('../lib/config')
const { SyncSource, PurgeSource } = require('../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../lib/stats/setUp')
const statsScenario = require('../tests/qa/scenarios/stats')
const { syncSourceDataSet2 } = require('../tests/fixtures/syncStats')
const { purgeSourceDataSet1 } = require('../tests/fixtures/purgeStats')
const { typeDefs: graphqlScalarTypeDefs, resolvers: graphqlScalarResolvers } = require('graphql-scalars')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const _ = require('lodash')
const destinationManagerLib = require('../lib/sync/destinationManager')
const downloaderLib = require('../lib/sync/downloader')
const EventEmitter = require('events')
const pino = require('pino')
const dotenv = require('dotenv')
dotenv.config()

const userConfig = buildUserConfig()
const k = knex({
  client: 'mysql2',
  connection: userConfig.database.connectionString
})
Model.knex(k)

const pubsub = new PubSub()

const typeDefs = gql`
  interface DatabaseRecord {
    created_at: DateTime!
    updated_at: DateTime
  }

  type Source {
    name: String!
  }

  type UserConfig {
    sources: [Source!]!
  }

  type SyncDestination implements DatabaseRecord{
    id: Int!
    sync_resources_id: Int!
    name: String!
    num_records_synced: Int!
    created_at: DateTime!
    updated_at: DateTime
  }

  type SyncResource implements DatabaseRecord {
    id: Int!
    sync_sources_id: Int!
    name: String!
    is_done: Boolean!
    created_at: DateTime!
    updated_at: DateTime
    destinations: [SyncDestination!]!
  }

  type SyncSource implements DatabaseRecord {
    id: Int!
    name: String!
    batch_id: String!
    result: String
    error: String
    created_at: DateTime!
    updated_at: DateTime
    resources: [SyncResource!]!
  }

  type PurgeDestination implements DatabaseRecord{
    id: Int!
    purge_resources_id: Int!
    name: String!
    num_records_purged: Int!
    ids_purged: [String!]!
    created_at: DateTime!
    updated_at: DateTime
  }

  type PurgeResource implements DatabaseRecord {
    id: Int!
    purge_sources_id: Int!
    name: String!
    is_done: Boolean!
    created_at: DateTime!
    updated_at: DateTime
    destinations: [PurgeDestination!]!
  }

  type PurgeSource implements DatabaseRecord {
    id: Int!
    name: String!
    batch_id: String!
    result: String
    error: String
    created_at: DateTime!
    updated_at: DateTime
    resources: [PurgeResource!]!
  }

  type StatsDetailsDestination {
    name: String!
    num_records: Int!
    most_recent_at: DateTime
  }

  type StatsDetailsResource {
    name: String!
    num_records_in_mls: Int
    most_recent_at: DateTime
    destinations: [StatsDetailsDestination!]!
  }
  
  type SyncStats {
    sync: [SyncSource!]!
    purge: [PurgeSource!]!
  }

  type Query {
    userConfig: UserConfig
    syncStats(sourceName: String): SyncStats!
    syncStatsDetails(sourceName: String): [StatsDetailsResource!]!
  }
`

const resolvers = {
  // (parent, args, context, info)
  Query: {
    userConfig: async () => {
      return userConfig
    },
    syncStats: async (parent, args) => {
      function getStatsForSource(sourceName, type) {
        let dbType
        if (type === 'sync') {
          dbType = SyncSource
        } else if (type === 'purge') {
          dbType = PurgeSource
        } else {
          throw new Error(`875864567 - invalid type ${type}`)
        }
        return dbType.query()
          .where({ name: sourceName })
          .orderBy(['created_at'], 'desc')
          .limit(3)
          .withGraphFetched({
            resources: {
              destinations: true,
            },
          })
      }

      if (args.sourceName) {
        const [s, p] = await Promise.all([
          getStatsForSource(args.sourceName, 'sync'),
          getStatsForSource(args.sourceName, 'purge'),
        ])
        return {
          sync: s,
          purge: p,
        }
      }

      const [s, p] = await Promise.all([
        Promise.all(userConfig.sources.map(x => getStatsForSource(x.name, 'sync'))),
        Promise.all(userConfig.sources.map(x => getStatsForSource(x.name, 'purge'))),
      ])
      const syncStats = _.flatMap(s)
      const purgeStats = _.flatMap(p)
      return {
        sync: syncStats,
        purge: purgeStats,
      }
    },
    syncStatsDetails: async (parent, args) => {
      const internalConfig = await getInternalConfig()
      const configBundle = { userConfig, internalConfig, flushInternalConfig }
      const eventEmitter = new EventEmitter()
      const logger = new pino({ level: 'silent' })
      const destinationManager = destinationManagerLib(args.sourceName, configBundle, eventEmitter, logger)
      const data = await destinationManager.getStatsDetails()

      const downloader = downloaderLib(args.sourceName, configBundle, eventEmitter, logger)
      const source = getMlsSourceUserConfig(userConfig, args.sourceName)
      const resourcesCountAndMostRecent = await Promise.all(source.mlsResources.map(mlsResourceObj => {
        return downloader.fetchCountAndMostRecent(mlsResourceObj)
      }))
      data.forEach((datum, i) => {
        datum.num_records_in_mls = resourcesCountAndMostRecent[i].count
        datum.most_recent_at = datum.num_records_in_mls > 0 ? resourcesCountAndMostRecent[i].mostRecent.ModificationTimestamp : null
      })

      return data
    },
  },
}

const server = new ApolloServer({
  schema: makeExecutableSchema({
    typeDefs: [
      ...typeDefs.definitions,
      ...graphqlScalarTypeDefs,
    ],
    resolvers: {
      ...graphqlScalarResolvers,
      ...resolvers,
    },
  }),
  // The only way I knew to use subscriptions here was from:
  // https://github.com/apollographql/apollo-server/issues/1534#issuecomment-413179501
  subscriptions: {
    path: '/subscriptions',
    onConnect: async (connectionParams, webSocket) => {
      // console.log('subscription onConnect')
    },
  },
})

async function setUpQaScenario() {
  const fns = [
    () => SyncSource.query().insertGraphAndFetch(syncSourceDataSet2),
    () => PurgeSource.query().insertGraphAndFetch(purgeSourceDataSet1),
  ]
  await statsScenario(fns)
  console.log('Done setting up scenario')
}

async function startServer() {
  await setUpQaScenario()

  server.listen(userConfig.server.port).then(({url}) => {
    console.log(`🚀 Server ready at ${url}`);
  })
}

startServer()
