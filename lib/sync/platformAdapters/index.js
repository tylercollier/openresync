const bridgeInteractivePlatformAdapter = require('./bridgeInteractive')
const trestlePlatformAdapter = require('./trestle')
const mlsGridPlatformAdapter = require('./mlsGrid')
const rmlsPlatformAdapter = require('./rmls')

module.exports = {
  makePlatformAdapter(name) {
    if (name === 'bridgeInteractive') {
      return bridgeInteractivePlatformAdapter()
    } else if (name === 'trestle') {
      return trestlePlatformAdapter()
    } else if (name === 'mlsGrid') {
      return mlsGridPlatformAdapter()
    } else if (name === 'rmls') {
      return rmlsPlatformAdapter()
    } else {
      throw new Error('Unknown platform adapter: ' + name)
    }
  }
}
