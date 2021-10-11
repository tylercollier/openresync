const { parentPort } = require('worker_threads')

parentPort.on('message', async data => {
  const {
    dataInAdapter,
    userFieldName,
    dataInMls,
    officialFieldName,
    timestampFieldNames,
    mysqlTimestampFieldNames,
  } = data
  const rowsObj = dataInAdapter.reduce((a, v) => {
    a[v[userFieldName]] = v
    return a
  }, {})
  const missingOrOldObjs = dataInMls.reduce((a, v, index) => {
    const id = v[officialFieldName]
    const dbObj = rowsObj[id]
    if (dbObj) {
      for (let i = 0; i < timestampFieldNames.length; i++) {
        if (v[timestampFieldNames[i]] === null && dbObj[mysqlTimestampFieldNames[i]] === null) {
          continue
        }
        const mlsTimestamp = new Date(v[timestampFieldNames[i]])
        const dbTimestamp = dbObj[mysqlTimestampFieldNames[i]]
        const equal = mlsTimestamp.getTime() === dbTimestamp.getTime()
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
