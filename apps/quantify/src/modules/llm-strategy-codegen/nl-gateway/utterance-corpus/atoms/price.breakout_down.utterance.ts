import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceBreakoutDownUtterances = [
  { id: 'price-breakout-down-zh-channel-low', atomKey: 'price.breakout_down' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格跌回最近 12 根 K 线低点时平多，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-zh-short', atomKey: 'price.breakout_down' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '跌破最近 30 根 K 线最低价做空，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-mixed', atomKey: 'price.breakout_down' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 1h，跌破最近 10 根 K 线低点 open short，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
