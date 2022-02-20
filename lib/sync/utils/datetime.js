const moment = require('moment-timezone')
const { sendAt, timeout } = require('cron')
const orderBy = require('lodash/orderBy')

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
// Moment decides to go from "a few seconds ago" (or "from now") to "a minute ago" at 44.5 seconds, not 45. It just
// occurred to me, but could we have used code straight from moment.js to do this? Ugh.
const approx45SecondsInMilliseconds = 44.5 * 1000
// The underscore prefix is because I can't start a variable name with a number.
const _21_5HoursInMilliseconds = 21.5 * hourInMilliseconds
const _45MinutesInMilliseconds = 45 * minuteInMilliseconds
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
  if (diffMilliseconds >= _21_5HoursInMilliseconds) {
    const exactDays = diffMilliseconds / dayInMilliseconds
    const roundedDays = Math.round(exactDays)
    return (roundedDays + .5) * dayInMilliseconds - diffMilliseconds
  } else if (diffMilliseconds >= _45MinutesInMilliseconds) {
    const exactHours = diffMilliseconds / hourInMilliseconds
    const roundedHours = Math.round(exactHours)
    return (roundedHours + .5) * hourInMilliseconds - diffMilliseconds
  } else if (diffMilliseconds >= approx45SecondsInMilliseconds) {
    const exactMinutes = diffMilliseconds / minuteInMilliseconds
    const roundedMinutes = Math.round(exactMinutes)
    return (roundedMinutes + .5) * minuteInMilliseconds - diffMilliseconds
  }
  return approx45SecondsInMilliseconds - diffMilliseconds
}

function getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime) {
  const diffMilliseconds = newTime.diff(oldTime)
  if (diffMilliseconds < approx45SecondsInMilliseconds) {
    return diffMilliseconds
  } else if (diffMilliseconds < 90 * 1000) {
    return diffMilliseconds - approx45SecondsInMilliseconds
  } else if (diffMilliseconds < _45MinutesInMilliseconds) {
    const exactMinutes = diffMilliseconds / minuteInMilliseconds
    const roundedMinutes = Math.round(exactMinutes)
    return diffMilliseconds - ((roundedMinutes - .5) * minuteInMilliseconds)
  } else if (diffMilliseconds < hourInMilliseconds * 1.5) {
    const exactHours = diffMilliseconds / hourInMilliseconds
    const roundedHours = Math.round(exactHours)
    return diffMilliseconds - ((roundedHours - .25) * hourInMilliseconds)
  } else if (diffMilliseconds < _21_5HoursInMilliseconds) {
    const exactHours = diffMilliseconds / hourInMilliseconds
    const roundedHours = Math.round(exactHours)
    return diffMilliseconds - ((roundedHours - .5) * hourInMilliseconds)
  } else if (diffMilliseconds < hourInMilliseconds * 36) {
    return diffMilliseconds - _21_5HoursInMilliseconds
  }
  const exactDays = diffMilliseconds / dayInMilliseconds
  const roundedDays = Math.round(exactDays)
  return diffMilliseconds - ((roundedDays - .5) * dayInMilliseconds)
}

function getNextDateFromCronStrings(cronStrings) {
  const nextDates = cronStrings.map(sendAt)
  const orderedNextDates = orderBy(nextDates)
  return orderedNextDates[0]
}

function getNextTimeoutFromCronStrings(cronStrings) {
  const timeouts = cronStrings.map(timeout)
  const orderedTimeouts = orderBy(timeouts)
  return orderedTimeouts[0]
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
  displayStringFormat,
  getMillisecondsUntilRelativeTimeChange,
  getMillisecondsUntilUpcomingRelativeTimeChange,
  getNextDateFromCronStrings,
  getNextTimeoutFromCronStrings,
}
