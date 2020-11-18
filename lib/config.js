const config = require('../config/config')
const _ = require('lodash')

function getDefaults() {
  return {
    server: {
      port: 4000,
    },
  }
}

let builtConfig
function buildConfig() {
  if (!builtConfig) {
    builtConfig = _.merge({}, getDefaults(), config)
  }
  return builtConfig
}

module.exports = {
  buildConfig,
}
