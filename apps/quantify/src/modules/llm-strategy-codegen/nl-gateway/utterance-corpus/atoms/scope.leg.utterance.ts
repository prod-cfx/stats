import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const scopeLegUtterances = [
  { id: 'scope-leg-zh-hedge', atomKey: 'scope.leg' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '做多 BTC 同时做空 ETH，等比对冲。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.leg' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-leg-zh-ratio', atomKey: 'scope.leg' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '对冲组合：BTC 做多 1000U、ETH 做空 500U。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.leg' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-leg-en-locked', atomKey: 'scope.leg' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Long BTC leg paired with short ETH leg, equal ratio hedge.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.leg' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
