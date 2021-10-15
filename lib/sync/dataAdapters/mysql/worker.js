const { parentPort, workerData } = require('worker_threads')

// Reminder to self:
// The reason I'm not using parentPort.on('message'), even though it seems like the more flexible / future-proof
// approach is that because if I throw in an error in that, it doesn't make its way back to the parent. There's probably
// a way, but I didn't see it initially looking through the Node 12 docs, so this way seems good enough for now.

const {
  dataInAdapter,
  userFieldName,
  dataInMls,
  officialFieldName,
  timestampFieldNames,
  mysqlTimestampFieldNames,
} = workerData
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
