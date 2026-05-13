import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceBreakoutUpUtterances = [
  { id: 'price-breakout-up-zh-channel-high', atomKey: 'price.breakout_up' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格突破最近 24 根 K 线高点且突破缓冲 0.25% 时做多开仓，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_up' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-up-zh-buy', atomKey: 'price.breakout_up' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '突破最近 20 根 K 线最高价买入，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_up' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-up-mixed', atomKey: 'price.breakout_up' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，突破最近 12 根 K 线高点 enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_up' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-up-zh-15min-ema20', atomKey: 'price.breakout_up' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15min，价格上破最近 20 根 K 线前高且站上 ema20 时开多，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.breakout_up' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-breakout-up-en-15min-channel-high', atomKey: 'price.breakout_up' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 15min, breakout last 30 bar channel high above ema20 enter long, position 10%.', expected: { owner: 'trigger' as const, key: 'price.breakout_up' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
