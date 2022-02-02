const bridgeInteractivePlatformAdapter = require('./bridgeInteractive')
const trestlePlatformAdapter = require('./trestle')
const mlsGridPlatformAdapter = require('./mlsGrid')

module.exports = {
  makePlatformAdapter(name) {
    if (name === 'bridgeInteractive') {
      return bridgeInteractivePlatformAdapter()
    } else if (name === 'trestle') {
      return trestlePlatformAdapter()
    } else if (name === 'mlsGrid') {
      return mlsGridPlatformAdapter()
    } else {
      throw new Error('Unknown platform adapter: ' + name)
    }
  }
}
