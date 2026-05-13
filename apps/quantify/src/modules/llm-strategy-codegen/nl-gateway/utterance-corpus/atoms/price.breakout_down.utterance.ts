import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceBreakoutDownUtterances = [
  { id: 'price-breakout-down-zh-channel-low', atomKey: 'price.breakout_down' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格跌回最近 12 根 K 线低点时平多，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-zh-short', atomKey: 'price.breakout_down' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '跌破最近 30 根 K 线最低价做空，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-mixed', atomKey: 'price.breakout_down' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 1h，跌破最近 10 根 K 线低点 open short，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-zh-15分钟-ema60', atomKey: 'price.breakout_down' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15分钟，价格下破最近 20 根 K 线前低且跌破 ema60 时开空，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-down-en-15min-channel-low', atomKey: 'price.breakout_down' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 15min, breakdown last 30 bar channel low under ema60 open short, position 10%.', expected: { owner: 'trigger' as const, key: 'price.breakout_down' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
