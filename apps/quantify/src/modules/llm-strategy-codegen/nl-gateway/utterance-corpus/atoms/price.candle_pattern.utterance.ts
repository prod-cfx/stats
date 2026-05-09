import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceCandlePatternUtterances = [
  {
    id: 'price-candle-pattern-zh-locked-engulfing-bullish',
    atomKey: 'price.candle_pattern',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，出现看涨吞没形态后开多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'locked',
      params: { pattern: 'engulfing', direction: 'bullish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-candle-pattern-en-locked-hammer-bearish',
    atomKey: 'price.candle_pattern',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, bearish hammer candle pattern confirmed, open short, 5% stop loss, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'locked',
      params: { pattern: 'hammer', direction: 'bearish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-candle-pattern-mixed-locked-doji-bullish',
    atomKey: 'price.candle_pattern',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，bullish doji 出现后开多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'locked',
      params: { pattern: 'doji', direction: 'bullish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-candle-pattern-mixed-locked-consecutive-body',
    atomKey: 'price.candle_pattern',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，bullish consecutive body 连续 3 根后做多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'locked',
      params: { pattern: 'consecutive_body', direction: 'bullish', minBars: 3 },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-candle-pattern-zh-open-slot-missing-direction',
    atomKey: 'price.candle_pattern',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，hammer 形态确认且市场整体看跌，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'open',
      params: { pattern: 'hammer' },
      openSlotKeys: ['price.candle_pattern.direction'],
    },
  },
  {
    id: 'price-candle-pattern-zh-open-slot-consecutive-min-bars',
    atomKey: 'price.candle_pattern',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，bullish consecutive body 后做多，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'price.candle_pattern',
      status: 'open',
      params: { pattern: 'consecutive_body', direction: 'bullish' },
      openSlotKeys: ['price.candle_pattern.minBars'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

