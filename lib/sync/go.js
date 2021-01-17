const downloaderLib = require('./downloader')
const destinationManagerLib = require('./destinationManager')
const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')
const EventEmitter = require('events')

async function go() {
  const userConfig = buildUserConfig()
  let internalConfig = await getInternalConfig()
  const configBundle = {
    userConfig,
    internalConfig,
    flushInternalConfig,
  }

  const mlsSourceName = 'aborBridgeInteractive'
  const eventEmitter = new EventEmitter()
  const aborDownloader = downloaderLib(mlsSourceName, configBundle, eventEmitter)
  const destinationManager = destinationManagerLib(mlsSourceName, configBundle, eventEmitter)
  aborDownloader.setDestinationManager(destinationManager)

  const metadataString = await aborDownloader.downloadMlsMetadata()
  try {
    // await destinationManager.syncMetadata(metadataString)
    await aborDownloader.downloadMlsResources()
  } finally {
    await destinationManager.closeConnections()
  }
}

go()