const axios = require('axios')
const concatStream = require('concat-stream')
const ProgressBar = require('progress')
const moment = require('moment')
const fsPromises = require('fs').promises
const pathLib = require('path')

const fileNameTimestampFormatString = 'YYYY-MM-DD-T-HH-mm-ss-SSS'

function catcher(msg, { destinationManager } = {}) {
  return function(error) {
    console.log('Error in ' + msg)
    console.log('error', error)
    let p = Promise.resolve()
    if (destinationManager) {
      p = destinationManager.closeConnections()
    }
    p.then(() => {
      process.exit(1)
    })
  }
}

// Inspired by https://futurestud.io/tutorials/axios-download-progress-in-node-js
async function fetchWithProgress(axiosConfig, progressCb) {
  const { data, headers } = await axios({
    ...axiosConfig,
    responseType: 'stream',
  })

  return new Promise((resolve, reject) => {
    const contentLength = headers['content-length']
    if (contentLength) {
      const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
        width: 40,
        complete: '=',
        incomplete: ' ',
        total: parseInt(contentLength),
      })

      data.on('data', chunk => {
        progressBar.tick(chunk.length)
      })
    }

    function done(val) {
      // console.log('contentLength', contentLength)
      // console.log('count', count)
      // console.log('length', length)
      // console.log('val.length', val.length)
      resolve(val)
    }
    const concatter = concatStream({ encoding: 'string' }, done)
    data.pipe(concatter)
    data.on('error', reject)
  })
}

function unpackErrorForSerialization(e) {
  // return JSON.stringify(e, Object.getOwnPropertyNames(e))
  return {
    message: e.message,
    stack: e.stack,
  }
}

async function getSourceFiles(userConfig, mlsSourceName) {
  const filesPerMlsResource = await Promise.all(userConfig.sources[mlsSourceName].mlsResources.map(mlsResource => getMlsResourceDirFiles(mlsSourceName, mlsResource)))
  return filesPerMlsResource
}

function getSourceFilesForBatch(sourceFiles, batchId) {
  return sourceFiles.map(filesForMlsResource => {
    if (filesForMlsResource === null) {
      return []
    }
    return filesForMlsResource.filter(file => {
      return pathLib.basename(file).startsWith('batch_' + batchId)
    })
  })
}

function getOldestBatchId(filesPerMlsResource) {
  let oldestBatchTimestamp = null
  for (const filesArray of filesPerMlsResource) {
    if (filesArray === null) {
      continue;
    }
    for (const filePath of filesArray) {
      const fileName = pathLib.basename(filePath)
      const batchId = fileName.match(/batch_(.*)_seq/)
      const timestampFromId = convertBatchIdToTimestamp(batchId)
      if (oldestBatchTimestamp === null || timestampFromId.isBefore(oldestBatchTimestamp)) {
        oldestBatchTimestamp = timestampFromId
      }
    }
  }
  return convertTimestampToBatchId(oldestBatchTimestamp)
}

function convertTimestampToBatchId(timestamp) {
  return timestamp.format(fileNameTimestampFormatString) + 'Z'
}

function convertBatchIdToTimestamp(batchId) {
  return moment.utc(batchId, fileNameTimestampFormatString)
}

async function getMlsResourceDirFiles(mlsSourceName, mlsResource) {
  const dirPath = getMlsResourceDir(mlsSourceName, mlsResource)
  try {
    await fsPromises.access(dirPath)
  } catch (e) {
    return null
  }
  const items = (await fsPromises.readdir(dirPath, { withFileTypes: true }))
    .filter(item => !item.isDirectory())
    .map(item => item.name)
  const sortedItems = naturalSort(items)
  const sortedFilePaths = sortedItems.map(x => pathLib.join(dirPath, x))
  return sortedFilePaths
}

function getMlsResourceDir(mlsSourceName, mlsResource) {
  const dirPath = pathLib.resolve(__dirname, `../../config/sources/${mlsSourceName}/downloadedData/${mlsResource}`)
  return dirPath
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base', ignorePunctuation: true })

const naturalSort = (array, selector, options) => {
  let a = array.slice()
  if (selector) {
    a = a.sort((a, b) => collator.compare(selector(a), selector(b)))
  } else {
    a.sort((a, b) => collator.compare(a, b))
  }
  if (!selector) {
    options = selector
  }
  if (options && options.reverse) {
    a.reverse()
  }
  return a
}

module.exports = {
  catcher,
  fetchWithProgress,
  unpackErrorForSerialization,
  getMlsResourceDirFiles,
  getMlsResourceDir,
  getOldestBatchId,
  convertTimestampToBatchId,
  convertBatchIdToTimestamp,
  getSourceFiles,
  getSourceFilesForBatch,
}
