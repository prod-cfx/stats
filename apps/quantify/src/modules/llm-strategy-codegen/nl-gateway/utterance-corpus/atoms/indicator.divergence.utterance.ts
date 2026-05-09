import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorDivergenceUtterances = [
  {
    id: 'indicator-divergence-en-locked-bullish-rsi',
    atomKey: 'indicator.divergence',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, RSI bullish divergence entry, 5% stop loss.',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'locked',
      params: { indicator: 'rsi', direction: 'bullish', pivotWindow: 14, confirmationBars: 3 },
      openSlotKeys: [],
    },
  },
  {
    id: 'indicator-divergence-zh-locked-bearish-rsi',
    atomKey: 'indicator.divergence',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，RSI 顶背离后开空，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'locked',
      params: { indicator: 'rsi', direction: 'bearish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'indicator-divergence-zh-open-slot-missing-direction',
    atomKey: 'indicator.divergence',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，RSI 背离后交易，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'open',
      params: { indicator: 'rsi' },
      openSlotKeys: ['indicator.divergence.direction'],
    },
  },
  {
    id: 'indicator-divergence-zh-open-slot-missing-indicator',
    atomKey: 'indicator.divergence',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，顶背离后开空，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'open',
      params: { direction: 'bearish' },
      openSlotKeys: ['indicator.divergence.indicator'],
    },
  },
  {
    id: 'indicator-divergence-zh-open-slot-missing-both',
    atomKey: 'indicator.divergence',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，背离后交易，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'open',
      openSlotKeys: ['indicator.divergence.indicator', 'indicator.divergence.direction'],
    },
  },
  {
    id: 'indicator-divergence-zh-locked-bearish-kdj-open-indicator',
    atomKey: 'indicator.divergence',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，KDJ 顶背离开空。',
    expected: {
      owner: 'trigger',
      key: 'indicator.divergence',
      status: 'open',
      params: { direction: 'bearish' },
      openSlotKeys: ['indicator.divergence.indicator'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

