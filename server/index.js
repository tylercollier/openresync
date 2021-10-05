const { ApolloServer, gql, PubSub } = require('apollo-server-express')
const { buildUserConfig, getInternalConfig, flushInternalConfig, getMlsSourceUserConfig } = require('../lib/config')
const { SyncSource, PurgeSource, ReconcileSource } = require('../lib/models/index')
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
const CronJob = require('cron').CronJob
const pathLib = require('path')
const moment = require('moment')
const statsSyncLib = require('../lib/stats/sync')
const statsPurgeLib = require('../lib/stats/purge')
const statsReconcileLib = require('../lib/stats/reconcile')
const utils = require('../lib/sync/utils')
const express = require('express')
const { createServer } = require('http')

const dotenv = require('dotenv')
dotenv.config()

const userConfig = buildUserConfig()
const db = knex({
  client: 'mysql2',
  connection: userConfig.database.connectionString
})
Model.knex(db)

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

  type ReconcileDestination implements DatabaseRecord{
    id: Int!
    reconcile_resources_id: Int!
    name: String!
    num_records_reconciled: Int!
    created_at: DateTime!
    updated_at: DateTime
  }

  type ReconcileResource implements DatabaseRecord {
    id: Int!
    reconcile_sources_id: Int!
    name: String!
    is_done: Boolean!
    created_at: DateTime!
    updated_at: DateTime
    destinations: [ReconcileDestination!]!
  }

  type ReconcileSource implements DatabaseRecord {
    id: Int!
    name: String!
    batch_id: String!
    result: String
    error: String
    created_at: DateTime!
    updated_at: DateTime
    resources: [ReconcileResource!]!
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
    reconcile: [ReconcileSource!]!
  }
  
  type CronSkedj {
    cronStrings: [String]
    nextDate: DateTime
  }

  type CronSchedule {
    sourceName: String!
    sync: CronSkedj
    purge: CronSkedj
    reconcile: CronSkedj
  }

  type Query {
    userConfig: UserConfig
    syncStats(sourceName: String): SyncStats!
    syncStatsDetails(sourceName: String): [StatsDetailsResource!]!
    cronSchedules(sourceName: String): [CronSchedule!]!
  }

  type Subscription {
    numRunningJobs: Int!
  }
`

const resolvers = {
  // (parent, args, context, info)
  Query: {
    userConfig: async () => {
      return userConfig
    },
    syncStats: async (parent, args) => {
      async function getStatsForSource(sourceName, type) {
        let dbType
        if (type === 'sync') {
          dbType = SyncSource
        } else if (type === 'purge') {
          dbType = PurgeSource
        } else if (type === 'reconcile') {
          dbType = ReconcileSource
        } else {
          throw new Error(`875864567 - invalid type ${type}`)
        }
        return dbType.query()
          .where({ name: sourceName })
          .orderBy('created_at', 'desc')
          .limit(3)
          .withGraphFetched({
            resources: {
              destinations: true,
            },
          })
      }

      if (args.sourceName) {
        const [s, p, r] = await Promise.all([
          getStatsForSource(args.sourceName, 'sync'),
          getStatsForSource(args.sourceName, 'purge'),
          getStatsForSource(args.sourceName, 'reconcile'),
        ])
        return {
          sync: s,
          purge: p,
          reconcile: r,
        }
      }

      const [s, p, r] = await Promise.all([
        Promise.all(userConfig.sources.map(x => getStatsForSource(x.name, 'sync'))),
        Promise.all(userConfig.sources.map(x => getStatsForSource(x.name, 'purge'))),
        Promise.all(userConfig.sources.map(x => getStatsForSource(x.name, 'reconcile'))),
      ])
      const syncStats = _.flatMap(s)
      const purgeStats = _.flatMap(p)
      const reconcileStats = _.flatMap(r)
      return {
        sync: syncStats,
        purge: purgeStats,
        reconcile: reconcileStats,
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
    cronSchedules: async (parent, args) => {
      function getNextDate(cronStrings) {
        const cronJobs = cronStrings.map(x => new CronJob(x, () => {}))
        const orderedJobs = _.orderBy(cronJobs, x => x.nextDate())
        return orderedJobs[0].nextDate().toISOString()
      }
      function getCronSchedule(sourceName) {
        const sourceConfig = getMlsSourceUserConfig(userConfig, sourceName)
        let syncStuff = null
        const syncCronStrings = _.get(sourceConfig, 'cron.sync.cronStrings')
        if (syncCronStrings && syncCronStrings.length) {
          syncStuff = {
            cronStrings: sourceConfig.cron.sync.cronStrings,
            nextDate: getNextDate(syncCronStrings),
          }
        }
        let purgeStuff = null
        const purgeCronStrings = _.get(sourceConfig, 'cron.purge.cronStrings')
        if (purgeCronStrings && purgeCronStrings.length) {
          purgeStuff = {
            cronStrings: sourceConfig.cron.purge.cronStrings,
            nextDate: getNextDate(purgeCronStrings),
          }
        }
        let reconcileStuff = null
        const reconcileCronStrings = _.get(sourceConfig, 'cron.reconcile.cronStrings')
        if (reconcileCronStrings && reconcileCronStrings.length) {
          reconcileStuff = {
            cronStrings: sourceConfig.cron.reconcile.cronStrings,
            nextDate: getNextDate(reconcileCronStrings),
          }
        }
        return {
          sourceName,
          sync: syncStuff,
          purge: purgeStuff,
          reconcile: reconcileStuff,
        }
      }

      const sourceNames = args.sourceName ? [args.sourceName] : userConfig.sources.map(x => x.name)
      return sourceNames.map(getCronSchedule)
    },
  },
  Subscription: {
    numRunningJobs: {
      subscribe() {
        console.log('subscription thing is happening for numRunningJobs')
        return pubsub.asyncIterator(['numRunningJobs'])
      },
    },
  },
}

let count = 0
setInterval(() => {
  count++
  pubsub.publish('numRunningJobs', {
    numRunningJobs: count,
  })
}, 3000)

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
  // await setUpQaScenario()

  // Start Apollo server
  await server.start()

  const app = express()
  // In a high volume production environment, you'd use e.g. nginx as a reverse proxy to serve static assets.
  // But if those requests get here, this will handle them. Works great for getting it set up, or for low volume.
  app.use(express.static(pathLib.resolve(__dirname, '../dist')))
  server.applyMiddleware({ app })
  // I got these lines from https://stackoverflow.com/a/67926714/135101
  const httpServer = createServer(app)
  server.installSubscriptionHandlers(httpServer)
  httpServer.listen(userConfig.server.port, () => {
    console.log(`🚀 Server listening on port ${userConfig.server.port}`);
  })
}


function getCronJobs(internalConfig) {
  const jobs = []
  userConfig.sources.forEach(source => {
    const sourceName = source.name
    const sourceConfig = getMlsSourceUserConfig(userConfig, sourceName)
    const syncCronStrings = _.get(sourceConfig, 'cron.sync.cronStrings', [])
    const purgeCronStrings = _.get(sourceConfig, 'cron.purge.cronStrings', [])
    const reconcileCronStrings = _.get(sourceConfig, 'cron.reconcile.cronStrings', [])

    if (syncCronStrings.length || purgeCronStrings.length || reconcileCronStrings.length) {
      const eventEmitter = new EventEmitter()
      const logger = pino({
        level: 'debug',
        // I don't care about the hostname, pid
        base: null,
        timestamp: pino.stdTimeFunctions.isoTime,
      }, pino.destination(pathLib.resolve(__dirname, `../logs/${sourceName}.ndjson`)))
      const configBundle = {
        userConfig,
        internalConfig,
        flushInternalConfig,
      }
      const downloader = downloaderLib(sourceName, configBundle, eventEmitter, logger)
      const destinationManager = destinationManagerLib(sourceName, configBundle, eventEmitter, logger)
      downloader.setDestinationManager(destinationManager)

      async function doSync() {
        const metadataString = await downloader.downloadMlsMetadata()
        const metadata = await utils.parseMetadataString(metadataString)
        await destinationManager.syncMetadata(metadata)

        await downloader.downloadMlsResources()
        await destinationManager.resumeSync('sync')
      }

      async function doPurge() {
        await downloader.downloadPurgeData()
        await destinationManager.resumePurge()
      }

      async function doReconcile() {
        const metadataString = await downloader.downloadMlsMetadata()
        const metadata = await utils.parseMetadataString(metadataString)
        await downloader.downloadReconcileData()
        await downloader.downloadMissingData()
        await destinationManager.resumeSync('missing', metadata)
      }

      const syncCronEnabled = _.get(sourceConfig, 'cron.sync.enabled', true)
      if (syncCronEnabled && syncCronStrings.length) {
        for (const cronString of syncCronStrings) {
          const cronTime = cronString
          // For debugging, start in a few seconds, rather than read the config
          // const m = moment().add(2, 'seconds')
          // const cronTime = m.toDate()
          const job = new CronJob(cronTime, doSync)
          jobs.push(job)
          const statsSync = statsSyncLib(db)
          statsSync.listen(eventEmitter)
        }
      }
      const purgeCronEnabled = _.get(sourceConfig, 'cron.purge.enabled', true)
      if (purgeCronEnabled && purgeCronStrings.length) {
        for (const cronString of purgeCronStrings) {
          const cronTime = cronString
          // For debugging, start in a few seconds, rather than read the config
          // const m = moment().add(2, 'seconds')
          // const cronTime = m.toDate()
          const job = new CronJob(cronString, doPurge)
          jobs.push(job)
          const statsPurge = statsPurgeLib(db)
          statsPurge.listen(eventEmitter)
        }
      }
      const reconcileCronEnabled = _.get(sourceConfig, 'cron.reconcile.enabled', true)
      if (reconcileCronEnabled && reconcileCronStrings.length) {
        for (const cronString of reconcileCronStrings) {
          const cronTime = cronString
          // For debugging, start in a few seconds, rather than read the config
          // const m = moment().add(2, 'seconds')
          // const cronTime = m.toDate()
          const job = new CronJob(cronString, doReconcile)
          jobs.push(job)
          const statsReconcile = statsReconcileLib(db)
          statsReconcile.listen(eventEmitter)
        }
      }

      // For debug, to force continuous. Use instead of cron.
      // (async () => {
      //   const statsSync = statsSyncLib(db)
      //   statsSync.listen(eventEmitter)
      //   while (true) {
      //     await doSync()
      //     // logger.debug({ seconds: 5 }, 'Debug wait...')
      //     // await new Promise(resolve => setTimeout(resolve, 5000))
      //   }
      // })()
    }
  })
  return jobs
}

function startCronJobs(jobs) {
  jobs.forEach(x => x.start())
}

async function runCron() {
  await setUp(db)

  const internalConfig = await getInternalConfig()
  const jobs = await getCronJobs(internalConfig)
  startCronJobs(jobs)
}

startServer()
runCron()
