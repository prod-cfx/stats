import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorCrossUnderUtterances = [
  { id: 'indicator-cross-under-ema-exit', atomKey: 'indicator.cross_under' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'EMA7 下穿 EMA21 平多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_under' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-under-rsi', atomKey: 'indicator.cross_under' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'RSI14 下穿 50 时卖出，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_under' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-under-mixed-macd', atomKey: 'indicator.cross_under' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'MACD DIF 下穿 DEA 平多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_under' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-under-zh-15分钟-ema60-ema20', atomKey: 'indicator.cross_under' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15分钟，ema60 死叉 ema20 平多，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_under' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-under-en-ema-crosses-below', atomKey: 'indicator.cross_under' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 4h, ema21 crosses below ema7 close long, position 10%.', expected: { owner: 'trigger' as const, key: 'indicator.cross_under' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
