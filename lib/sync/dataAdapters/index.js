const mysqlDataAdapter = require('./mysql')
const devnullDataAdapter = require('./devnull')

// I'm not happy about this. Previously, I was using require() in the buildDataAdapter() method below.
// As in, I was doing conditional requires. Jest tests would break with the message MODULE NOT FOUND.
// I think it was happening because require() was being called after a test had started, so it wasn't
// using the real require() but rather Jest's monkey-patched version. I don't want to fight it right now.
const bridgeInteractivePlatformAdapter = require('../platformAdapters/bridgeInteractive')
const trestlePlatformAdapter = require('../platformAdapters/trestle')
const bridgeInteractiveMysqlPlatformDataAdapter = require('../platformDataAdapters/bridgeInteractive/mysql')
const trestleMysqlPlatformDataAdapter = require('../platformDataAdapters/trestle/mysql')

function buildDataAdapter({ destinationConfig, platformAdapterName }) {
  const dataAdapterType = destinationConfig.type
  let dataAdapter
  if (dataAdapterType === 'mysql') {
    dataAdapter = mysqlDataAdapter({ destinationConfig: destinationConfig.config })
  } else if (dataAdapterType === 'devnull') {
    dataAdapter = devnullDataAdapter()
  } else {
    throw new Error('Unknown data adapter: ' + dataAdapterType)
  }

  let platformAdapter
  if (platformAdapterName === 'bridgeInteractive') {
    platformAdapter = bridgeInteractivePlatformAdapter()
  } else if (platformAdapterName === 'trestle') {
    platformAdapter = trestlePlatformAdapter()
  } else {
    throw new Error('Unknown platform adapter: ' + platformAdapterName)
  }
  dataAdapter.setPlatformAdapter(platformAdapter)

  let platformDataAdapter
  if (dataAdapterType === 'mysql') {
    if (platformAdapterName === 'bridgeInteractive') {
      platformAdapter = bridgeInteractiveMysqlPlatformDataAdapter()
    } else if (platformAdapterName === 'trestle') {
      platformAdapter = trestleMysqlPlatformDataAdapter()
    } else {
      throw new Error(`Unknown platform adapter and data adapter combo: ${platformAdapterName}, ${dataAdapterType}`)
    }
    dataAdapter.setPlatformDataAdapter(platformDataAdapter)
  }

  return dataAdapter
}

module.exports = {
  buildDataAdapter,
}
