import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const oscillatorRsiGteUtterances = [
  { id: 'oscillator-rsi-gte-zh-exit', atomKey: 'oscillator.rsi_gte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'OKX ETHUSDT 15m，RSI14 高于 70 卖出平仓，仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-gte-mixed-short', atomKey: 'oscillator.rsi_gte' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 1h，RSI 9 above 70 做空，单笔 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-gte-zh-entry-short', atomKey: 'oscillator.rsi_gte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'RSI 大于 80 开空，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-gte-zh-15分钟-ema60', atomKey: 'oscillator.rsi_gte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15分钟，RSI14 上方 75 且价格高于 ema60 时开空，仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-gte-en-greater-than', atomKey: 'oscillator.rsi_gte' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 1h, RSI greater than 72 short, position 10%.', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_gte' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
