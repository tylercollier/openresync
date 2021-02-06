const _ = require('lodash')

export function doesConfigIncludeMlsResourceName(userConfig, mlsSourceName, mlsResourceName) {
  return _.any(userConfig.sources[mlsSourceName].mlsResources, x => x.name === mlsResourceName)
}