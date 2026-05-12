import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const pricePercentChangeUtterances = [
  { id: 'price-percent-change-zh-down-entry', atomKey: 'price.percent_change' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.percent_change' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-percent-change-zh-up-exit', atomKey: 'price.percent_change' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '15m 相对开仓均价上涨 2% 时卖出平仓，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.percent_change' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-percent-change-mixed-dip', atomKey: 'price.percent_change' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 5m，price 下跌 3% 做多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'price.percent_change' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
