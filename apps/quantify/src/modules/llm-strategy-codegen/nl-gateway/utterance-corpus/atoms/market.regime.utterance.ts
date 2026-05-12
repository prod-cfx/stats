import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const marketRegimeUtterances = [
  { id: 'market-regime-zh-range', atomKey: 'market.regime' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '震荡区间时启用区间交易，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'market.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'market-regime-zh-consolidation', atomKey: 'market.regime' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '区间震荡行情中只做网格，单笔 10%。', expected: { owner: 'trigger' as const, key: 'market.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'market-regime-mixed-range-bound', atomKey: 'market.regime' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT range-bound 时使用区间策略，仓位 10%。', expected: { owner: 'trigger' as const, key: 'market.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
