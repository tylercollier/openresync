const { ApolloServer, gql, PubSub } = require('apollo-server')
const { buildUserConfig, getInternalConfig, flushInternalConfig, getMlsSourceUserConfig } = require('../lib/config')
const { SyncSource } = require('../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../lib/stats/setUp')
const statsScenario = require('../tests/qa/scenarios/stats')
const { syncSourceDataSet1, syncSourceDataSet2 } = require('../tests/fixtures/syncStats')
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

  type Query {
    userConfig: UserConfig
    syncStats(sourceName: String): [SyncSource!]!
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
      function getStatsForSource(sourceName) {
        return SyncSource.query()
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
        return getStatsForSource(args.sourceName)
      }

      const data = await Promise.all(userConfig.sources.map(x => getStatsForSource(x.name)))
      return _.flatMap(data)
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
  await statsScenario(syncSourceDataSet2)
  console.log('Done setting up scenario')
}

async function startServer() {
  await setUpQaScenario()

  server.listen(userConfig.server.port).then(({url}) => {
    console.log(`🚀 Server ready at ${url}`);
  })
}

startServer()
