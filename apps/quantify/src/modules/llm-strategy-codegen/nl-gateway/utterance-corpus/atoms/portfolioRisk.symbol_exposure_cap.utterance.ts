import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const portfolioRiskSymbolExposureCapUtterances = [
  { id: 'portfolioRisk-symbol-exposure-cap-zh-block', atomKey: 'portfolioRisk.symbol_exposure_cap' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 单标的敞口不超过 30%，超过时阻止开仓。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.symbol_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'portfolioRisk-symbol-exposure-cap-zh-observe', atomKey: 'portfolioRisk.symbol_exposure_cap' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '标的敞口超 20% 时仅记录，不限制开仓。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.symbol_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'portfolioRisk-symbol-exposure-cap-en-locked', atomKey: 'portfolioRisk.symbol_exposure_cap' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Block new entries when BTCUSDT symbol exposure exceeds 30%.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.symbol_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
