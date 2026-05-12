import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorBelowUtterances = [
  { id: 'indicator-below-ma-exit', atomKey: 'indicator.below' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格跌破 MA50 平多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.below' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-below-ema-short', atomKey: 'indicator.below' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格下穿 EMA20 做空，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.below' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-below-mixed', atomKey: 'indicator.below' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，价格跌破 MA100 close long，单笔 10%。', expected: { owner: 'trigger' as const, key: 'indicator.below' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
