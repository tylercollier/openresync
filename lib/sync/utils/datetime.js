const moment = require('moment-timezone')

const fileNameTimestampFormatString = 'YYYY-MM-DD-T-HH-mm-ss-SSS[Z]'
const displayStringFormat = 'YYYY-MM-DD h:mm:ss a z'

function getDisplayDatetime(momentObj, relative = false) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const tzMoment = moment.tz(momentObj, timeZone)
  if (relative) {
    return tzMoment.fromNow()
  }
  return tzMoment.format(displayStringFormat)
}

function convertBatchIdToTimestamp(batchId) {
  return moment.utc(batchId, fileNameTimestampFormatString)
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
  displayStringFormat,
}
