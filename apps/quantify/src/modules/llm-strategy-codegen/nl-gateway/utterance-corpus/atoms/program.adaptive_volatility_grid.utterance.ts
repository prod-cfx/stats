import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const programAdaptiveVolatilityGridUtterances = [
  { id: 'program-adaptive-volatility-grid-zh-atr', atomKey: 'program.adaptive_volatility_grid' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'ATR(14) 1.5 倍步长 3 倍区间自适应网格 6 档，趋势上涨时启用。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.adaptive_volatility_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-adaptive-volatility-grid-zh-clamp', atomKey: 'program.adaptive_volatility_grid' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'ATR(20) 自适应网格 5 档每档钳制 0.1%-1.5%，停用平仓。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.adaptive_volatility_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-adaptive-volatility-grid-en-locked', atomKey: 'program.adaptive_volatility_grid' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Adaptive grid with step 1.5x ATR(14), 6 levels clamped to 0.2%-2%, cancel on deactivate.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.adaptive_volatility_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
