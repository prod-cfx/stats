import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const programDynamicGridUtterances = [
  { id: 'program-dynamic-grid-zh-anchor-high', atomKey: 'program.dynamic_grid' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，失活时撤单。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.dynamic_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-dynamic-grid-zh-anchor-mid', atomKey: 'program.dynamic_grid' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '围绕近 30 根 K 线中点挂 8 档动态网格，每档 0.8%，停用时保留挂单。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.dynamic_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-dynamic-grid-en-locked', atomKey: 'program.dynamic_grid' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Dynamic grid anchored at recent 50-bar high, 5 levels at 0.5% each, cancel orders on deactivate.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.dynamic_grid' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
