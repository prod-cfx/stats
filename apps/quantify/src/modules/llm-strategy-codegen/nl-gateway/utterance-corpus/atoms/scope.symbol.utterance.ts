import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const scopeSymbolUtterances = [
  { id: 'scope-symbol-zh-multi', atomKey: 'scope.symbol' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 和 ETHUSDT 同时跑相同策略，均线金叉开多。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.symbol' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-symbol-zh-primary', atomKey: 'scope.symbol' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 主标的，ETHUSDT 跟随，均线金叉。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.symbol' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-symbol-en-locked', atomKey: 'scope.symbol' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Run the same strategy on BTCUSDT and ETHUSDT with primary BTCUSDT.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.symbol' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
