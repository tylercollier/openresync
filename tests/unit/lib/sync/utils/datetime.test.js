const datetimeLib = require('../../../../../lib/sync/utils/datetime')
const moment = require('moment')

describe('datetime', () => {
  describe('getMillisecondsUntilRelativeTimeChange', () => {
    describe('[0, 45s)', () => {
      test('20s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:00:20Z')
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 25)
      })
    })

    describe('[45s, 45m)', () => {
      test('50s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:00:50Z')
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 40)
      })

      test('2m10s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:02:10Z')
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 20)
      })
    })

    describe('[45m, 21.5h)', () => {
      test('50m', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:50:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 40)
      })

      test('1h10m', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T01:10:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 20)
      })
    })

    describe('more than 21.5h', () => {
      test('1d2h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-02T02:00:00Z')
        // expect(oldTime.from(newTime)).toEqual(5)
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 10)
      })

      test('1y1d2h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2021-01-02T02:00:00Z')
        // expect(oldTime.from(newTime)).toEqual(5)
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 10)
      })
    })
  })
})
