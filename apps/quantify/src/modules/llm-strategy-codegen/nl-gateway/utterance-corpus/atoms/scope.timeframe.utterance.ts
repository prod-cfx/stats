import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const scopeTimeframeUtterances = [
  { id: 'scope-timeframe-zh-multi', atomKey: 'scope.timeframe' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '15m 主周期 + 1h 4h 依赖周期严格对齐。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.timeframe' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-timeframe-zh-execution', atomKey: 'scope.timeframe' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '执行周期 5m，参考 15m 1h 多时间框架 scope。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.timeframe' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-timeframe-en-locked', atomKey: 'scope.timeframe' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Primary timeframe 15m, required timeframes 1h and 4h, strict alignment.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.timeframe' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
