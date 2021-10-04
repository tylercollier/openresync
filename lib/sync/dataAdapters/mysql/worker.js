const { parentPort } = require('worker_threads')
const moment = require('moment')

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
        const mlsVal = moment.utc(v[timestampFieldNames[i]])
        const mysqlVal = moment.utc(dbObj[mysqlTimestampFieldNames[i]])
        if (!mlsVal.isSame(mysqlVal)) {
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
