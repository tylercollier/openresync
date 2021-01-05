const downloader = require('./downloader')
const destinationManager = require('./destinationManager')
const { buildUserConfig, getInternalConfig, flushInternalConfig } = require('../config')

async function go() {
  const userConfig = buildUserConfig()
  let internalConfig = await getInternalConfig()
  const configBundle = {
    userConfig,
    internalConfig,
    flushInternalConfig,
  }

  const mlsSourceName = 'aborBridgeInteractive'
  const aborDownloader = downloader(mlsSourceName, configBundle)
  const manager = destinationManager(mlsSourceName, configBundle)
  aborDownloader.setDestinationManager(manager)
  aborDownloader.startDownloading()
}

go()