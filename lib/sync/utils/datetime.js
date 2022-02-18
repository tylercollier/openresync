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

function getMillisecondsUntilRelativeTimeChange(oldTime, newTime) {
  // return oldTime.from(newTime)
  const duration = moment.duration(newTime.diff(oldTime))
  if (duration.years()) {
    if (duration.months() < 6) {
      const d = moment.duration({
        years: duration.years(),
        months: 6,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    } else {
      const d = moment.duration({
        years: duration.years() + 1,
        months: 6,
      })
      const momentForTimer = oldTime.clone().add(d)
      return momentForTimer
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
  }
  if (duration.days()) {
    if (duration.hours() < 12) {
      // throw new Error('sup' + duration.hours())
      const d = moment.duration({
        days: duration.days(),
        hours: 12,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    } else {
      const d = moment.duration({
        days: duration.days() + 1,
        hours: 12,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
  }
  if (duration.hours()) {
    if (duration.hours() >= 21) {
      if (duration.minutes() < 30) {
        const d = moment.duration({
          hours: 21,
          minutes: 30,
        })
        const momentForTimer = oldTime.clone().add(d)
        const milliseconds = momentForTimer.diff(newTime)
        return milliseconds / 1000
      } else {
        const d = moment.duration({
          days: 1,
          hours: 12,
        })
        const momentForTimer = oldTime.clone().add(d)
        const milliseconds = momentForTimer.diff(newTime)
        return milliseconds / 1000
      }
    }
    if (duration.minutes() < 30) {
      const d = moment.duration({
        hours: 1,
        minutes: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    } else {
      const d = moment.duration({
        hours: duration.hours() + 1,
        minutes: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
  }
  if (duration.minutes()) {
    if (duration.minutes() >= 45) {
      const d = moment.duration({
        hours: 1,
        minutes: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
    if (duration.seconds() < 30) {
      const d = moment.duration({
        minutes: duration.minutes(),
        seconds: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    } else {
      const d = moment.duration({
        minutes: duration.minutes() + 1,
        seconds: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
  } else {
    if (duration.seconds() < 45) {
      // const d = moment.duration({
      //   seconds: 30,
      // })
      // const momentForTimer = oldTime.clone().add(d)
      // const milliseconds = momentForTimer.diff(newTime)
      // return milliseconds / 1000
      return 45 - duration.seconds()
    } else {
      const d = moment.duration({
        minutes: 1,
        seconds: 30,
      })
      const momentForTimer = oldTime.clone().add(d)
      const milliseconds = momentForTimer.diff(newTime)
      return milliseconds / 1000
    }
  }
}

module.exports = {
  convertBatchIdToTimestamp,
  getDisplayDatetime,
  displayStringFormat,
  getMillisecondsUntilRelativeTimeChange,
}
