import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceRangePositionGteUtterances = [
  { id: 'price-range-position-gte-zh-grid-template', atomKey: 'price.range_position_gte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格回到最近 36 根 K 线区间上 55% 时卖出平仓，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-range-position-gte-zh-top', atomKey: 'price.range_position_gte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格在最近 20 根 K 线区间高位 80% 做空，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-range-position-gte-mixed', atomKey: 'price.range_position_gte' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，价格在最近 50 根 K 线区间上 75% open short，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
