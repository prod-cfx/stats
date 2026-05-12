import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceRangePositionLteUtterances = [
  { id: 'price-range-position-lte-zh-grid-template', atomKey: 'price.range_position_lte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格位于最近 36 根 K 线区间下 20% 时买入，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-range-position-lte-zh-bottom', atomKey: 'price.range_position_lte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格在最近 20 根 K 线区间低位 15% 做多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-range-position-lte-mixed', atomKey: 'price.range_position_lte' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，价格在最近 50 根 K 线区间下 25% enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.range_position_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
