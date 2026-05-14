import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const gateSubStrategyUtterances = [
  { id: 'gate-sub-strategy-zh-switch', atomKey: 'gate.subStrategy' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '趋势成立时切到趋势子策略；震荡时切到震荡子策略。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'gate-sub-strategy-zh-pause', atomKey: 'gate.subStrategy' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '盘整时暂停趋势子策略。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'gate-sub-strategy-en-locked', atomKey: 'gate.subStrategy' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Switch to trend sub-strategy when trend is active, switch to range sub-strategy when ranging.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.subStrategy' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
