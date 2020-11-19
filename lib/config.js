const config = require('../config/config')
const _ = require('lodash')
const fsPromises = require('fs').promises
const pathLib = require('path')

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
    builtUserConfig = _.merge({}, getDefaults(), config)
  }
  return builtUserConfig
}

const internalConfigFilePath = pathLib.resolve(__dirname + '/../config/internalConfig.json')
let internalConfigObj
async function getInternalConfig() {
  if (!internalConfigObj) {
    const fileContents = await fsPromises.readFile(internalConfigFilePath, 'utf8')
      .catch(async error => {
        if (error.code === 'ENOENT') {
          await fsPromises.writeFile(internalConfigFilePath, '{}')
          return '{}'
        }
        throw error
      })
    internalConfigObj = JSON.parse(fileContents)
  }
  return internalConfigObj
}

let internalConfigWritePromise = Promise.resolve()
function flushInternalConfig() {
  const fileDataString = JSON.stringify(internalConfigObj, null, 2)
  return internalConfigWritePromise.finally(() => {
    const p = fsPromises.writeFile(internalConfigFilePath, fileDataString)
    internalConfigWritePromise = p
    return p
  })
}

module.exports = {
  buildUserConfig,
  getInternalConfig,
  flushInternalConfig,
}
