import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorAboveUtterances = [
  { id: 'indicator-above-ma-entry', atomKey: 'indicator.above' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格突破 MA50 买入，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.above' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-above-ema-filter', atomKey: 'indicator.above' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，价格在 1h EMA200 上方时才做多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'indicator.above' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-above-mixed', atomKey: 'indicator.above' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 1h，价格突破 MA20 enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.above' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
