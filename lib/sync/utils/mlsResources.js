const _ = require('lodash')

function doesConfigIncludeMlsResourceName(userConfig, mlsSourceName, mlsResourceName) {
  return _.some(userConfig.sources[mlsSourceName].mlsResources, x => x.name === mlsResourceName)
}

module.exports = {
  doesConfigIncludeMlsResourceName,
}
