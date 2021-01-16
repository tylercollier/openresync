const downloader = require('./downloader')
const destinationManager = require('./destinationManager')
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
  const aborDownloader = downloader(mlsSourceName, configBundle, eventEmitter)
  const manager = destinationManager(mlsSourceName, configBundle, eventEmitter)
  aborDownloader.setDestinationManager(manager)
  aborDownloader.startDownloading()
}

go()