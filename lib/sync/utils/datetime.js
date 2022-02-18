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

const hourInSeconds = 60 * 60
const dayInSeconds = hourInSeconds * 24
// Get the milliseconds until moment.js would change the relative time, e.g. "x minutes ago". We return milliseconds
// with the expectation that it will be used for setTimeout. It answers the question "in how many milliseconds would
// moment.js change the relative time shown?". For simplicity, the max is never more than 24 hours (in milliseconds).
// Reminder: the delineations here are based on moment.js's "Time from X" behavior. Some things to note:
// - You might think it'd round at half past certain values, e.g. 30+ seconds would be "1 minute". But that's not what
//   it does. (It's exact to the second, up to 45 seconds, when it switches to round to the nearest minute.) There are
//   similar semi-arbitrary dilineations for other values, like 21.5+ hours becomes a day, etc.
// - You might think that 3.5+ days rounds to a week. But moment.js doesn't round to a week, ever. It uses days up
//   until it switches to monhts.
function getMillisecondsUntilRelativeTimeChange(oldTime, newTime) {
  const diffSeconds = newTime.diff(oldTime, 'seconds')
  if (diffSeconds >= hourInSeconds * 21.5) {
    const exactDays = diffSeconds / dayInSeconds
    const roundedDays = Math.round(exactDays)
    return 1000 * (roundedDays * dayInSeconds + 12 * hourInSeconds) - diffSeconds * 1000
  } else if (diffSeconds >= 60 * 45) {
    const exactHours = diffSeconds / hourInSeconds
    const roundedHours = Math.round(exactHours)
    return 1000 * ((roundedHours + .5) * hourInSeconds) - diffSeconds * 1000
  } else if (diffSeconds > 45) {
    const exactMinutes = diffSeconds / 60
    const roundedMinutes = Math.round(exactMinutes)
    return 1000 * ((roundedMinutes + .5) * 60) - diffSeconds * 1000
  }
  return 1000 * (45 - diffSeconds)
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
  displayStringFormat,
  getMillisecondsUntilRelativeTimeChange,
}
