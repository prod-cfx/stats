import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const executionOnStartUtterances = [
  { id: 'execution-on-start-zh-buy', atomKey: 'execution.on_start' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '立即开始时市价买入一次，BTCUSDT 1h，单笔 10%。', expected: { owner: 'trigger' as const, key: 'execution.on_start' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'execution-on-start-zh-close', atomKey: 'execution.on_start' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '马上当前价平仓一次，ETHUSDT 15m，仓位 10%。', expected: { owner: 'trigger' as const, key: 'execution.on_start' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'execution-on-start-mixed-sell', atomKey: 'execution.on_start' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 5m，启动时市价卖出一次，单笔 10%。', expected: { owner: 'trigger' as const, key: 'execution.on_start' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
