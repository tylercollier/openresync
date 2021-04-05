const config = require('../config/config')
const _ = require('lodash')
const fsPromises = require('fs').promises
const pathLib = require('path')
const moment = require('moment')

const version = '0.1.0'

function getDefaults() {
  return {
    server: {
      port: 4000,
    },
  }
}

let builtUserConfig
function buildUserConfig() {
  if (!builtUserConfig) {
    builtUserConfig = _.merge({}, getDefaults(), config())
    if (builtUserConfig.version !== version) {
      // TODO: this is where we'd first try to upgrade the config.
      throw new Error(`User config version (${builtUserConfig.version}) does not match software version (${version})`)
    }
  }
  return builtUserConfig
}

const internalConfigFilePath = pathLib.resolve(__dirname, '../config/internalConfig.json')
let internalConfigObj
async function getInternalConfig() {
  if (!internalConfigObj) {
    let fileContents
    try {
      fileContents = await fsPromises.readFile(internalConfigFilePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        const defaultConfig = {
          version,
        }
        internalConfigObj = defaultConfig
        await flushInternalConfig()
        return defaultConfig
      }
      throw error
    }
    internalConfigObj = JSON.parse(fileContents)
    if (internalConfigObj.version !== version) {
      // TODO: this is where we'd first try to upgrade the config.
      throw new Error(`Internal config version (${internalConfigObj}) does not match software version (${version})`)
    }
  }
  return internalConfigObj
}

// Ensure we never try to write to this file multiple times simultaneously or we'll corrupt it.
let internalConfigWritePromise = Promise.resolve()
async function flushInternalConfig() {
  const fileDataString = JSON.stringify(internalConfigObj, null, 2)
  internalConfigWritePromise = internalConfigWritePromise.finally(() => {
    return fsPromises.writeFile(internalConfigFilePath, fileDataString)
  })
  return internalConfigWritePromise
}

function getBatch(mlsSourceInternalConfig, batchName) {
  const batch = _.get(mlsSourceInternalConfig, batchName)
  if (batch) {
    batch.batchTimestamp = moment.utc(batch.batchTimestamp)
  }
  return batch
}

function getMlsSourceUserConfig(userConfig, mlsSourceName) {
  return userConfig.sources.find(x => x.name === mlsSourceName)
}

function getMlsSourceInternalConfig(internalConfig, mlsSourceName) {
  const sources = _.get(internalConfig, ['sources'], [])
  let config = sources.find(x => x.name === mlsSourceName)
  if (config) {
    return config
  }
  config = {
    name: mlsSourceName,
  }
  if (!internalConfig.sources) {
    internalConfig.sources = []
  }
  internalConfig.sources.push(config)
  return config
}

module.exports = {
  buildUserConfig,
  getInternalConfig,
  flushInternalConfig,
  getBatch,
  getMlsSourceUserConfig,
  getMlsSourceInternalConfig,
}
