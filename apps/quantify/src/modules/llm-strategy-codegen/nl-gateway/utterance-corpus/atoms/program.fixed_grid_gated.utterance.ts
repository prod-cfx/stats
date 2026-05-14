import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const programFixedGridGatedUtterances = [
  { id: 'program-fixed-grid-gated-zh-range', atomKey: 'program.fixed_grid_gated' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.fixed_grid_gated' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-fixed-grid-gated-zh-anchor', atomKey: 'program.fixed_grid_gated' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '锚定 50000 挂 10 档 5% 步长，失活时撤单。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.fixed_grid_gated' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-fixed-grid-gated-en-locked', atomKey: 'program.fixed_grid_gated' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Place 10-level grid in range 50000-60000 (step 5%), cancel orders on deactivate.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.fixed_grid_gated' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
