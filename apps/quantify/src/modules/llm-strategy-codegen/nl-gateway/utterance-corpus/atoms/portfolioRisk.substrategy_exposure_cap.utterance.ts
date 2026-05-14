import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const portfolioRiskSubstrategyExposureCapUtterances = [
  { id: 'portfolioRisk-substrategy-exposure-cap-zh-pause', atomKey: 'portfolioRisk.substrategy_exposure_cap' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '趋势子策略仓位上限 50%，超过时暂停子策略。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.substrategy_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'portfolioRisk-substrategy-exposure-cap-zh-block', atomKey: 'portfolioRisk.substrategy_exposure_cap' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '子策略敞口超 40% 时阻止开仓。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.substrategy_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'portfolioRisk-substrategy-exposure-cap-en-locked', atomKey: 'portfolioRisk.substrategy_exposure_cap' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Pause sub-strategy when its exposure exceeds 40%.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'portfolioRisk.substrategy_exposure_cap' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
