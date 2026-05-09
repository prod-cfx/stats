import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceChartPatternUtterances = [
  {
    id: 'price-chart-pattern-zh-locked-head-and-shoulders-bullish',
    atomKey: 'price.chart_pattern',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 1h，出现头肩底形态后开多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'locked',
      params: { pattern: 'head_and_shoulders', direction: 'bullish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-chart-pattern-en-locked-double-top',
    atomKey: 'price.chart_pattern',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 1h, double top breakdown confirmed, open short, 5% stop loss, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'locked',
      params: { pattern: 'double_top', direction: 'bearish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-chart-pattern-mixed-locked-double-bottom',
    atomKey: 'price.chart_pattern',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 1h，double bottom 形态确认后做多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'locked',
      params: { pattern: 'double_bottom', direction: 'bullish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-chart-pattern-en-locked-triangle-bullish',
    atomKey: 'price.chart_pattern',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 1h, bullish triangle breakout, open long, 5% stop loss, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'locked',
      params: { pattern: 'triangle', direction: 'bullish' },
      openSlotKeys: [],
    },
  },
  {
    id: 'price-chart-pattern-zh-open-slot-missing-direction',
    atomKey: 'price.chart_pattern',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 1h，triangle 形态确认后入场，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'open',
      params: { pattern: 'triangle' },
      openSlotKeys: ['price.chart_pattern.direction'],
    },
  },
  {
    id: 'price-chart-pattern-en-open-slot-head-and-shoulders',
    atomKey: 'price.chart_pattern',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 1h, head and shoulders pattern confirmed, enter on breakout.',
    expected: {
      owner: 'trigger',
      key: 'price.chart_pattern',
      status: 'open',
      params: { pattern: 'head_and_shoulders' },
      openSlotKeys: ['price.chart_pattern.direction'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

