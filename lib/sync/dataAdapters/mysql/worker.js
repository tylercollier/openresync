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
        // If both are null, we consider them equal
        if (v[timestampFieldNames[i]] === null && dbObj[mysqlTimestampFieldNames[i]] === null) {
          continue
        }
        // But at this point, if either are null, then they are out of sync
        if (v[timestampFieldNames[i]] === null || dbObj[mysqlTimestampFieldNames[i]] === null) {
          a.push(v)
          break
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
