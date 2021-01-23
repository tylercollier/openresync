const axios = require('axios')
const concatStream = require('concat-stream')
const ProgressBar = require('progress')

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

async function getMlsResourceDirFiles(mlsResource) {
  const dirPath = getMlsResourceDir(mlsResource)
  try {
    await fsPromises.access(dirPath)
  } catch (e) {
    return null
  }
  const items = (await fsPromises.readdir(dirPath, { withFileTypes: true }))
    .filter(item => !item.isDirectory())
    .map(item => item.name)
    .sort()
  return items
}

function getMlsResourceDir(mlsResource) {
  const dirPath = pathLib.resolve(__dirname, `../../config/sources/${mlsSourceName}/downloadedData/${mlsResource}`)
  return dirPath
}

module.exports = {
  catcher,
  fetchWithProgress,
  unpackErrorForSerialization,
  getMlsResourceDirFiles,
  getMlsResourceDir,
}
