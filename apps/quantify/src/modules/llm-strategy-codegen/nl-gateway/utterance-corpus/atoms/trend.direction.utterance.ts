import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const trendDirectionUtterances = [
  { id: 'trend-direction-zh-up-gate', atomKey: 'trend.direction' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '市场趋势向上时只做多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'trend.direction' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'trend-direction-zh-down-short', atomKey: 'trend.direction' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '趋势向下时做空，仓位 10%。', expected: { owner: 'trigger' as const, key: 'trend.direction' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'trend-direction-mixed-bull', atomKey: 'trend.direction' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 1h trend up 做多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'trend.direction' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
