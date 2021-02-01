const downloaderLib = require('./downloader')
const destinationManagerLib = require('./destinationManager')
const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const EventEmitter = require('events')
const pathLib = require('path')
const pino = require('pino')

async function go() {
  const userConfig = buildUserConfig()
  let internalConfig = await getInternalConfig()
  const configBundle = {
    userConfig,
    internalConfig,
    flushInternalConfig,
  }

  const mlsSourceName = 'aborBridgeInteractive'
  // const mlsSourceName = 'aborTrestle'
  const eventEmitter = new EventEmitter()
  const logger = pino({
    // I don't care about the hostname, pid
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  }, pino.destination(pathLib.resolve(__dirname, '../../log/log.json')))
  const aborDownloader = downloaderLib(mlsSourceName, configBundle, eventEmitter, logger)
  const destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter, logger)
  aborDownloader.setDestinationManager(destinationManager)

  const metadataString = await aborDownloader.downloadMlsMetadata()
  try {
    // await destinationManager.syncMetadata(metadataString)
    await aborDownloader.downloadMlsResources()
    // await destinationManager.resumeUpsert()
    // await aborDownloader.downloadPurgeData()
    // await destinationManager.resumePurge()
  } finally {
    await destinationManager.closeConnections()
  }
}

go()