import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const gateRegimeUtterances = [
  { id: 'gate-regime-zh-ema-long', atomKey: 'gate.regime' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格高于 EMA50 才允许做多。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'gate-regime-zh-trend-allow', atomKey: 'gate.regime' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '上涨趋势才允许做多，下跌趋势才允许做空。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'gate-regime-en-locked', atomKey: 'gate.regime' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Allow long only when price is above EMA50.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'gate.regime' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
