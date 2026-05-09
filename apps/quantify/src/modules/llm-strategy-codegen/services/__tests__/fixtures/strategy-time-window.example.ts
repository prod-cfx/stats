/**
 * strategy.time_window atom 示例 fixture
 *
 * params.timezone: IANA timezone string (e.g. "Asia/Shanghai", "UTC")
 * params.windows: JSON-encoded string of Array<{start: string; end: string; daysOfWeek?: number[]}>
 *   - start/end are HH:mm 24-hour strings
 *   - daysOfWeek optional: 0=Sunday … 6=Saturday
 */

export const TIME_WINDOW_EXAMPLES = {
  /** 北京时间 9:30-11:30 开仓 */
  beijingMorning: {
    timezone: 'Asia/Shanghai',
    windows: JSON.stringify([{ start: '09:30', end: '11:30' }]),
  },

  /** UTC 09:30-11:30 开仓（英文 utterance 场景） */
  utcMorning: {
    timezone: 'UTC',
    windows: JSON.stringify([{ start: '09:30', end: '11:30' }]),
  },

  /** 纽约时间 09:30-16:00（美股交易时段） */
  newYorkSession: {
    timezone: 'America/New_York',
    windows: JSON.stringify([{ start: '09:30', end: '16:00' }]),
  },

  /** 北京时间上午 + 下午两段 */
  beijingTwoWindows: {
    timezone: 'Asia/Shanghai',
    windows: JSON.stringify([
      { start: '09:30', end: '11:30' },
      { start: '13:00', end: '15:00' },
    ]),
  },
} as const
