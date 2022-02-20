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
        const milliseconds = datetimeLib.getMillisecondsUntilRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 10)
      })
    })
  })

  describe('getMillisecondsUntilUpcomingRelativeTimeChange', () => {
    describe('(-45s, 0s]', () => {
      test('20s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:00:20Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 20)
      })
    })

    describe('(-1m30s, -45s]', () => {
      test('50s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:00:50Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 5)
      })

      test('55s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:00:55Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 10)
      })

      test('1m20s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:01:20Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 35)
      })
    })

    describe('(-45m, -1m30s]', () => {
      test('2m10s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:02:10Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 40)
      })

      test('5m25s', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:05:25')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 55)
      })
    })

    describe('(-21h30m, -45m]', () => {
      test('50m', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T00:50:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 5)
      })

      test('1h10m', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T01:10:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 25)
      })

      test('2h10m', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T02:10:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 40)
      })
    })

    describe('(-1d12h, -21h30m]', () => {
      test('22h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-01T22:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 30)
      })

      test('1d1h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-02T01:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 3.5)
      })

      test('1d11h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-02T11:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 13.5)
      })
    })

    describe('farther back than 36 hours', () => {
      test('37h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-02T13:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 1)
      })

      test('9d17h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-10T17:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 5)
      })

      test('20d3h', () => {
        const oldTime = moment.utc('2020-01-01T00:00:00Z')
        const newTime = moment.utc('2020-01-21T03:00:00Z')
        const milliseconds = datetimeLib.getMillisecondsUntilUpcomingRelativeTimeChange(oldTime, newTime)
        expect(milliseconds).toEqual(1000 * 60 * 60 * 15)
      })
    })
  })
})
