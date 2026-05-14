import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const scopeSubStrategyUtterances = [
  { id: 'scope-sub-strategy-zh-switch', atomKey: 'scope.subStrategy' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '趋势行情用趋势子策略，震荡行情用震荡子策略，切换时平掉旧仓位。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-sub-strategy-zh-atr', atomKey: 'scope.subStrategy' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '在 BTCUSDT 上跑两套子策略，根据 ATR 切换。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-sub-strategy-en-locked', atomKey: 'scope.subStrategy' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Use sub-strategy A in trend regime, sub-strategy B in range, close positions on switch.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
