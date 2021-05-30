const downloaderLib = require('./downloader')
const destinationManagerLib = require('./destinationManager')
const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const EventEmitter = require('events')
const pathLib = require('path')
const pino = require('pino')
const CronJob = require('cron').CronJob

async function go() {
  const userConfig = buildUserConfig()
  let internalConfig = await getInternalConfig()
  const configBundle = {
    userConfig,
    internalConfig,
    flushInternalConfig,
  }

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
    await objs.destinationManager.resumeSync('sync')
  }

  async function doPurge(objs) {
    await objs.downloader.downloadPurgeData()
    await objs.destinationManager.resumePurge()
  }

  async function doReconcile(objs) {
    await objs.downloader.downloadReconcileData()
    await objs.downloader.downloadMissingData()
    await objs.destinationManager.resumeSync('missing')
  }

  async function run() {
    const eventEmitter = new EventEmitter()
    const logger = pino({
      level: 'trace',
      // I don't care about the hostname, pid
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    }, pino.destination(pathLib.resolve(__dirname, '../../logs/recolorado_res.ndjson')))

    const trestleStuff = makeObjs('recolorado_res', eventEmitter, logger)

    // const metadataString = await trestleStuff.downloader.downloadMlsMetadata()
    //
    // try {
    //   await trestleStuff.destinationManager.syncMetadata(metadataString)
    // } catch (error) {
    //   logger.error({ err: error })
    //   console.log('error', error)
    //   await trestleStuff.destinationManager.closeConnections()
    //   process.exit(1)
    // }

    async function runOnce() {
      try {
        // await doSync(trestleStuff)
        // await doPurge(trestleStuff)
        await doReconcile(trestleStuff)
      } finally {
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
