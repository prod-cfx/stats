import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const oscillatorRsiLteUtterances = [
  { id: 'oscillator-rsi-lte-zh-entry', atomKey: 'oscillator.rsi_lte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'OKX BTCUSDT 1h，RSI14 低于 30 买入，单笔 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-lte-mixed-long', atomKey: 'oscillator.rsi_lte' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'Binance ETHUSDT 4h，RSI 低于 25 enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-lte-zh-dca', atomKey: 'oscillator.rsi_lte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'RSI9 小于 20 做多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-lte-zh-15min-ema20', atomKey: 'oscillator.rsi_lte' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15min，RSI14 跌破 30 且价格站上 ema20 时买入，仓位 10%。', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'oscillator-rsi-lte-en-falls-below', atomKey: 'oscillator.rsi_lte' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 4h, RSI14 falls below 28 enter long, position 10%.', expected: { owner: 'trigger' as const, key: 'oscillator.rsi_lte' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
