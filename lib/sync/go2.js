const downloaderLib = require('./downloader')
const destinationManagerLib = require('./destinationManager')
const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const EventEmitter = require('events')
const pathLib = require('path')
const pino = require('pino')
const CronJob = require('cron').CronJob
const utils = require('./utils')
const knex = require('knex')
const statsSyncLib = require('../stats/sync')
const statsPurgeLib = require('../stats/purge')
const statsReconcileLib = require('../stats/reconcile')
const { setUp } = require('../stats/setUp')

async function go() {
  const userConfig = buildUserConfig()
  let internalConfig = await getInternalConfig()
  const configBundle = {
    userConfig,
    internalConfig,
    flushInternalConfig,
  }
  const statsDb = knex({
    client: 'mysql2',
    connection: userConfig.database.connectionString
  })

  function makeObjs(mlsSourceName, eventEmitter, logger) {
    const downloader = downloaderLib(mlsSourceName, configBundle, eventEmitter, logger)
    const destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter, logger)
    downloader.setDestinationManager(destinationManager)
    return {
      downloader,
      destinationManager,
    }
  }

  async function doSync(objs) {
    await objs.downloader.downloadMlsResources()
    await objs.destinationManager.resumeSync('sync', objs.metadata)
  }

  async function doPurge(objs) {
    await objs.downloader.downloadPurgeData()
    await objs.destinationManager.resumePurge()
  }

  async function doReconcile(objs) {
    await objs.downloader.downloadReconcileData()
    await objs.downloader.downloadMissingData()
    await objs.destinationManager.resumeSync('missing', objs.metadata)
  }

  async function run() {
    const sourceName = 'recolorado_res'
    const eventEmitter = new EventEmitter()
    const logger = pino({
      level: 'trace',
      // I don't care about the hostname, pid
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    }, pino.destination(pathLib.resolve(__dirname, `../../logs/${sourceName}.ndjson`)))

    const trestleStuff = makeObjs(sourceName, eventEmitter, logger)

    const metadataString = await trestleStuff.downloader.downloadMlsMetadata()
    const metadata = await utils.parseMetadataString(metadataString)
    trestleStuff.metadata = metadata

    const statsSync = statsSyncLib(statsDb)
    const syncThunker = statsSync.listen(eventEmitter)
    const statsPurge = statsPurgeLib(statsDb)
    const purgeThunker = statsPurge.listen(eventEmitter)
    const statsReconcile = statsReconcileLib(statsDb)
    const reconcileThunker = statsReconcile.listen(eventEmitter)

    if (!true) {
      try {
        await trestleStuff.destinationManager.syncMetadata(metadata)
      } catch (error) {
        logger.error({err: error})
        console.log('error', error)
        await trestleStuff.destinationManager.closeConnections()
        process.exit(1)
      }
    }
    if (!true) {
      await setUp(statsDb)
    }

    async function runOnce() {
      try {
        // await doPurge(trestleStuff)

        // await doSync(trestleStuff)
        await doReconcile(trestleStuff)
        // await doPurge(trestleStuff)
      } finally {
        Promise.all([
          syncThunker.onEmptyQueue(),
          purgeThunker.onEmptyQueue(),
          reconcileThunker.onEmptyQueue(),
        ])
          .then(() => {
            statsDb.destroy()
          })
        trestleStuff.destinationManager.closeConnections()
      }
    }

    function runCron() {
      const trestleSyncJob = new CronJob('0 30 * * * *', async () => {
        logger.debug('Running trestleSyncJob')
        await doSync(trestleStuff)
      })
      trestleSyncJob.start()

      const trestlePurgeJob = new CronJob('0 30 */4 * * *', async () => {
        logger.debug('Running trestlePurgeJob')
        await doPurge(trestleStuff)
      })
      trestlePurgeJob.start()
    }

    runOnce()
    // runCron()

  }

  run()


}

go()
