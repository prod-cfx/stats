import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const scopeDataSourceUtterances = [
  { id: 'scope-data-source-zh-primary', atomKey: 'scope.dataSource' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '主行情源 binance.spot.btcusdt 同时订阅 binance.perp.btcusdt 作为确认源。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.dataSource' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-data-source-zh-event', atomKey: 'scope.dataSource' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '事件源使用 webhook tradingview.alert。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.dataSource' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'scope-data-source-en-locked', atomKey: 'scope.dataSource' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Primary feed binance.spot.btcusdt OHLCV, event source webhook tradingview.alpha.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'scope.dataSource' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
