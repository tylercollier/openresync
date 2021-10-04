const { parentPort, workerData } = require('worker_threads')
const moment = require('moment')

parentPort.on('message', async data => {
  const {
    dataInAdapter,
    userFieldName,
    dataInMls,
    officialFieldName,
    timestampFieldNames,
    solrTimestampFieldNames,
  } = data
  const docsObj = dataInAdapter.reduce((a, v) => {
    a[v[userFieldName]] = v
    return a
  }, {})
  const missingOrOldObjs = dataInMls.reduce((a, v, index) => {
    const id = v[officialFieldName]
    const solrObj = docsObj[id]
    if (solrObj) {
      for (let i = 0; i < timestampFieldNames.length; i++) {
        // Remember, the fields might not even exist on the Solr object.
        if (!v[timestampFieldNames[i]] && !solrObj[solrTimestampFieldNames[i]]) {
          continue
        }
        const mlsVal = moment.utc(v[timestampFieldNames[i]])
        const solrVal = moment.utc(solrObj[solrTimestampFieldNames[i]])
        if (!mlsVal.isSame(solrVal)) {
          a.push(v)
          break
        }
      }
    } else {
      a.push(v)
    }
    return a
  }, [])

  const missingOrOldIds = missingOrOldObjs.map(x => x[officialFieldName])
  parentPort.postMessage(missingOrOldIds)
})
