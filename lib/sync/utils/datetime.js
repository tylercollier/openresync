const moment = require('moment-timezone')

const fileNameTimestampFormatString = 'YYYY-MM-DD-T-HH-mm-ss-SSS[Z]'
const sortableFormatString = 'YYYY-MM-DD HH:mm:ss z'

function getDisplayDatetime(momentObj) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return moment.tz(momentObj, timeZone).format(sortableFormatString)
}

function convertBatchIdToTimestamp(batchId) {
  return moment.utc(batchId, fileNameTimestampFormatString)
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
}
