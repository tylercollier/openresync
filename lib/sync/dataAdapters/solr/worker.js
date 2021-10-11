const { parentPort } = require('worker_threads')

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
        const mlsTimestamp = new Date(v[timestampFieldNames[i]])
        const solrTimestamp = new Date(solrObj[solrTimestampFieldNames[i]])
        const equal = mlsTimestamp.getTime() === solrTimestamp.getTime()
        if (!equal) {
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
