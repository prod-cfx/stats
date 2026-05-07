import { InvalidTimezoneError, getWallClock, isWithinTimeWindow } from './timezone-clock'

describe('timezone-clock', () => {
  describe('getWallClock', () => {
    it('returns local hours/minutes/dayOfWeek in Asia/Shanghai for a known UTC instant', () => {
      // 2026-05-07 01:30:00 UTC == 09:30 Asia/Shanghai (Thu)
      const ts = Date.UTC(2026, 4, 7, 1, 30, 0)
      const result = getWallClock(ts, 'Asia/Shanghai')
      expect(result).toEqual({ hours: 9, minutes: 30, dayOfWeek: 4 })
    })

    it('returns local hours/minutes/dayOfWeek in UTC for a known UTC instant', () => {
      const ts = Date.UTC(2026, 4, 7, 1, 30, 0)
      const result = getWallClock(ts, 'UTC')
      expect(result).toEqual({ hours: 1, minutes: 30, dayOfWeek: 4 })
    })

    it('throws InvalidTimezoneError for non-IANA strings', () => {
      expect(() => getWallClock(0, 'Not/A_Real_TZ')).toThrow(InvalidTimezoneError)
    })

    it('handles second-precision timestamps by promoting to ms', () => {
      const tsSec = Math.floor(Date.UTC(2026, 4, 7, 1, 30, 0) / 1000)
      const result = getWallClock(tsSec, 'Asia/Shanghai')
      expect(result.hours).toBe(9)
      expect(result.minutes).toBe(30)
    })

    it('returns NaN fields for non-finite timestamps without throwing', () => {
      const result = getWallClock(Number.NaN, 'UTC')
      expect(Number.isFinite(result.hours)).toBe(false)
      expect(Number.isFinite(result.minutes)).toBe(false)
    })

    it('respects DST transition for Australia/Sydney April 2026 (DST ended Apr 5 2026 03:00 -> 02:00)', () => {
      // 2026-04-05 03:30 UTC == 13:30 Sydney (post-DST AEST UTC+10)
      const tsAfter = Date.UTC(2026, 3, 5, 3, 30, 0)
      const wallAfter = getWallClock(tsAfter, 'Australia/Sydney')
      expect(wallAfter.hours).toBe(13)
      // 2026-04-04 03:30 UTC == 14:30 Sydney (pre-DST AEDT UTC+11)
      const tsBefore = Date.UTC(2026, 3, 4, 3, 30, 0)
      const wallBefore = getWallClock(tsBefore, 'Australia/Sydney')
      expect(wallBefore.hours).toBe(14)
    })

    it('caches Intl.DateTimeFormat per timezone (no leak per call)', () => {
      const spy = jest.spyOn(Intl, 'DateTimeFormat')
      // First call to a fresh timezone — may construct OR hit existing cache from prior tests.
      // Capture baseline, then loop and assert no further constructions for same tz.
      const baseline = spy.mock.calls.length
      const tz = 'America/Los_Angeles'
      getWallClock(Date.UTC(2026, 4, 7, 1, 30, 0), tz)
      const afterFirst = spy.mock.calls.length
      for (let i = 0; i < 50; i++) {
        getWallClock(Date.UTC(2026, 4, 7, 2, 0, 0) + i * 60_000, tz)
      }
      const afterMany = spy.mock.calls.length
      expect(afterFirst - baseline).toBeLessThanOrEqual(1)
      expect(afterMany).toBe(afterFirst)
      spy.mockRestore()
    })
  })

  describe('isWithinTimeWindow', () => {
    const tz = 'Asia/Shanghai'
    const window = { start: '09:30', end: '15:00' }

    it('returns true when current shanghai time falls inside the window', () => {
      // 2026-05-07 02:00 UTC == 10:00 Asia/Shanghai
      const ts = Date.UTC(2026, 4, 7, 2, 0, 0)
      expect(isWithinTimeWindow(ts, tz, [window])).toBe(true)
    })

    it('returns false when before the window start', () => {
      // 2026-05-07 00:30 UTC == 08:30 Asia/Shanghai
      const ts = Date.UTC(2026, 4, 7, 0, 30, 0)
      expect(isWithinTimeWindow(ts, tz, [window])).toBe(false)
    })

    it('returns false when after the window end', () => {
      // 2026-05-07 08:30 UTC == 16:30 Asia/Shanghai
      const ts = Date.UTC(2026, 4, 7, 8, 30, 0)
      expect(isWithinTimeWindow(ts, tz, [window])).toBe(false)
    })

    it('honors daysOfWeek filter', () => {
      // 2026-05-09 02:00 UTC == 10:00 Sat
      const ts = Date.UTC(2026, 4, 9, 2, 0, 0)
      expect(isWithinTimeWindow(ts, tz, [{ ...window, daysOfWeek: [1, 2, 3, 4, 5] }])).toBe(false)
      expect(isWithinTimeWindow(ts, tz, [{ ...window, daysOfWeek: [6] }])).toBe(true)
    })

    it('handles cross-midnight windows (start > end)', () => {
      // 23:00 - 02:00 next day
      const w = { start: '23:00', end: '02:00' }
      // 2026-05-06 16:00 UTC == 2026-05-07 00:00 Asia/Shanghai
      const tsMidnight = Date.UTC(2026, 4, 6, 16, 0, 0)
      expect(isWithinTimeWindow(tsMidnight, tz, [w])).toBe(true)
      // 2026-05-07 06:00 UTC == 14:00 Asia/Shanghai
      const tsDay = Date.UTC(2026, 4, 7, 6, 0, 0)
      expect(isWithinTimeWindow(tsDay, tz, [w])).toBe(false)
    })

    it('returns false for empty window list', () => {
      expect(isWithinTimeWindow(Date.UTC(2026, 4, 7, 2, 0, 0), tz, [])).toBe(false)
    })
  })
})
