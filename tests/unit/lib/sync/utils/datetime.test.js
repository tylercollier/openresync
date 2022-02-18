const datetimeLib = require('../../../../../lib/sync/utils/datetime')
const moment = require('moment')

describe('datetime', () => {
  describe('getMillisecondsUntilRelativeTimeChange', () => {
    // 0s to 44s -> a few seconds ago
    // 45s to 1m29s -> a minute ago
    // Goes by minutes up through 44
    // 45m to 1h29m59s - an hour ago
    // Goes by hours up through 21.5
    // 21 hours, 30 minutes - a day ago
    // test('x', () => {
    //   const oldTime = moment.utc('2020-01-01T00:00:00Z')
    //   const newTime = moment.utc('2020-01-01T01:30:00Z')
    //   expect(oldTime.from(newTime)).toEqual(5)
    //   const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
    //   expect(seconds).toEqual(10)
    // })

    test('less than 45s', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T00:00:20Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(25)
    })

    test('between 45s and 1m29s', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T00:00:50Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(40)
    })

    test('between 1m30s and 2m29s', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T00:02:10Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(20)
    })

    test('between 45m and 1h', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T00:50:00Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(60 * 40)
    })

    test('between 1h and 1h30m', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T01:10:00Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(60 * 20)
    })

    test('between 21h and 21h30m', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-01T21:10:00Z')
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(60 * 20)
    })

    test('between 21h30m and 1d', () => {
      const oldTime = moment.utc('2020-01-01T00:00:00Z')
      const newTime = moment.utc('2020-01-02T02:00:00Z')
      // expect(oldTime.from(newTime)).toEqual(5)
      const seconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
      expect(seconds).toEqual(60 * 60 * 10)
    })
  })
})
