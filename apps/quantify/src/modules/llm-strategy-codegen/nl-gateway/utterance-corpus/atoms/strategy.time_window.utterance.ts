import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const strategyTimeWindowUtterances = [
  {
    id: 'strategy-time-window-zh-locked-shanghai',
    atomKey: 'strategy.time_window',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，北京时间 9:30 到 11:30 内允许开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'strategy.time_window',
      status: 'locked',
      params: { timezone: 'Asia/Shanghai', windows: [{ start: '09:30', end: '11:30' }] },
      openSlotKeys: [],
    },
  },
  {
    id: 'strategy-time-window-en-locked-utc',
    atomKey: 'strategy.time_window',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, allow entries between 09:30-11:30 UTC, MA20 cross above MA50, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'strategy.time_window',
      status: 'locked',
      params: { timezone: 'UTC', windows: [{ start: '09:30', end: '11:30' }] },
      openSlotKeys: [],
    },
  },
  {
    id: 'strategy-time-window-zh-open-slot-timezone',
    atomKey: 'strategy.time_window',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，时间窗口 9:30 到 11:30 内开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'strategy.time_window',
      status: 'open',
      params: { windows: [{ start: '09:30', end: '11:30' }] },
      openSlotKeys: ['strategy.time_window.timezone'],
    },
  },
  {
    id: 'strategy-time-window-zh-open-slot-windows',
    atomKey: 'strategy.time_window',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，只在 Asia/Shanghai 时区内开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'strategy.time_window',
      status: 'open',
      params: { timezone: 'Asia/Shanghai' },
      openSlotKeys: ['strategy.time_window.windows'],
    },
  },
  {
    id: 'strategy-time-window-en-open-slot-windows',
    atomKey: 'strategy.time_window',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m, only trade during UTC trading hours, MA20 cross above MA50, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'strategy.time_window',
      status: 'open',
      params: { timezone: 'UTC' },
      openSlotKeys: ['strategy.time_window.windows'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

