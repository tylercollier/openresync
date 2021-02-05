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

  async function doUpsert(objs) {
    await objs.downloader.downloadMlsResources()
    await objs.destinationManager.resumeUpsert()
  }

  async function doPurge(objs) {
    await objs.downloader.downloadPurgeData()
    await objs.destinationManager.resumePurge()
  }

  async function go2() {
    const eventEmitter = new EventEmitter()
    const logger = pino({
      level: 'debug',
      // I don't care about the hostname, pid
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    }, pino.destination(pathLib.resolve(__dirname, '../../log/log.json')))

    const aborBridgeInteractiveStuff = makeObjs('aborBridgeInteractive', eventEmitter, logger)
    const aborTrestleStuff = makeObjs('aborTrestle', eventEmitter, logger)

    const aborBridgeInteractiveMetadataString = await aborBridgeInteractiveStuff.downloader.downloadMlsMetadata()
    const aborTrestleMetadataString = await aborTrestleStuff.downloader.downloadMlsMetadata()

    try {
      await aborBridgeInteractiveStuff.destinationManager.syncMetadata(aborBridgeInteractiveMetadataString)
      await aborTrestleStuff.destinationManager.syncMetadata(aborTrestleMetadataString)


    } catch (e) {
      logger.error({ err: e })
    } finally {
      await aborBridgeInteractiveStuff.destinationManager.closeConnections()
      await aborTrestleStuff.destinationManager.closeConnections()
    }

    async function runOnce() {
      await doUpsert(aborBridgeInteractiveStuff)
      await doPurge(aborBridgeInteractiveStuff)

      await doUpsert(aborTrestleStuff)
      await doPurge(aborTrestleStuff)
    }

    function runCron() {
      const biUpsertJob = new CronJob('0 */4 * * * *', async () => {
        logger.debug('Running biUpsertJob')
        await doUpsert(aborBridgeInteractiveStuff)
      })
      biUpsertJob.start()

      const biPurgeJob = new CronJob('0 1-59/4 * * * *', async () => {
        logger.debug('Running biPurgeJob')
        await doPurge(aborBridgeInteractiveStuff)
      })
      biPurgeJob.start()

      const trestleUpsertJob = new CronJob('0 2-58/4 * * * *', async () => {
        logger.debug('Running trestleUpsertJob')
        await doUpsert(aborTrestleStuff)
      })
      trestleUpsertJob.start()

      const trestlePurgeJob = new CronJob('0 3-59/4 * * * *', async () => {
        logger.debug('Running trestlePurgeJob')
        await doPurge(aborTrestleStuff)
      })
      trestlePurgeJob.start()
    }

  }

  go2()


}

go()