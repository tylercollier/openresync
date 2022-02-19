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

const minuteInMilliseconds = 1000 * 60
const hourInMilliseconds = minuteInMilliseconds * 60
const dayInMilliseconds = hourInMilliseconds * 24
// Get the milliseconds until moment.js would change the relative time, e.g. "x minutes ago". We return milliseconds
// with the expectation that it will be used for setTimeout. It answers the question "in how many milliseconds would
// moment.js change the relative time shown?". The max is never more than 24 hours (in milliseconds), which seems like a
// reasonable compromise in that calls to setTimeout() wouldn't happen too often, but we save ourselves from the more
// complex computations that result from the different lengths of months depending on the exact dates used. For example:
//
//   const oldTime = moment.utc('2020-02-01T00:00:00Z')
//   const newTime = oldTime.clone().add(45, 'days')
//   oldTime.from(newTime)
//   // "2 months ago"
//
// but
//
//   const oldTime = moment.utc('2020-01-01T00:00:00Z')
//   const newTime = oldTime.clone().add(45, 'days')
//   oldTime.from(newTime)
//   // "1 month ago"
//
// Reminder: the delineations here are based on moment.js's "Time from X" behavior. Some things to note:
// - You might think it'd round at half past certain values, e.g. 30+ seconds would be "1 minute". But that's not what
//   it does. (It's exact to the second, up to 45 seconds, when it switches to round to the nearest minute.) There are
//   similar semi-arbitrary dilineations for other values, like 21.5+ hours becomes a day, etc.
// - You might think that 3.5+ days rounds to a week. But moment.js doesn't round to a week, ever. It uses days up
//   until it switches to monhts.
function getMillisecondsUntilRelativeTimeChange(oldTime, newTime) {
  const diffMilliseconds = newTime.diff(oldTime)
  if (diffMilliseconds >= hourInMilliseconds * 21.5) {
    const exactDays = diffMilliseconds / dayInMilliseconds
    const roundedDays = Math.round(exactDays)
    return (roundedDays * dayInMilliseconds + 12 * hourInMilliseconds) - diffMilliseconds
  } else if (diffMilliseconds >= minuteInMilliseconds * 45) {
    const exactHours = diffMilliseconds / hourInMilliseconds
    const roundedHours = Math.round(exactHours)
    return ((roundedHours + .5) * hourInMilliseconds) - diffMilliseconds
  } else if (diffMilliseconds >= 45 * 1000) {
    const exactMinutes = diffMilliseconds / minuteInMilliseconds
    const roundedMinutes = Math.round(exactMinutes)
    return ((roundedMinutes + .5) * minuteInMilliseconds) - diffMilliseconds
  }
  return 45 * 1000 - diffMilliseconds
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
  displayStringFormat,
  getMillisecondsUntilRelativeTimeChange,
}
