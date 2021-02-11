const mysqlDataAdapter = require('./mysql')
const devnullDataAdapter = require('./devnull')

function buildDataAdapter({ destinationConfig, platformAdapterName }) {
  const dataAdapterType = destinationConfig.type
  let adapter
  if (dataAdapterType === 'mysql') {
    adapter = mysqlDataAdapter({ destinationConfig: destinationConfig.config })
  } else if (dataAdapterType === 'devnull') {
    adapter = devnullDataAdapter()
  } else {
    throw new Error('Unknown data adapter: ' + dataAdapterType)
  }
  const platformAdapter = require(`../platformAdapters/${platformAdapterName}`)()
  adapter.setPlatformAdapter(platformAdapter)
  const platformDataAdapterPath = `../platformDataAdapters/${platformAdapterName}/${dataAdapterType}`
  let platformDataAdapter
  try {
    platformDataAdapter = require(platformDataAdapterPath)()
    adapter.setPlatformDataAdapter(platformDataAdapter)
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
  }
  return adapter
}

module.exports = {
  buildDataAdapter,
}
