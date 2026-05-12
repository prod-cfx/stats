import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const volatilityStateUtterances = [
  { id: 'volatility-state-zh-high', atomKey: 'volatility.state' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '波动率过高时暂停加仓，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'volatility.state' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'volatility-state-zh-low', atomKey: 'volatility.state' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '低波动时启用网格策略，单笔 10%。', expected: { owner: 'trigger' as const, key: 'volatility.state' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'volatility-state-mixed-high', atomKey: 'volatility.state' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT high volatility 时降低仓位，仓位 10%。', expected: { owner: 'trigger' as const, key: 'volatility.state' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
