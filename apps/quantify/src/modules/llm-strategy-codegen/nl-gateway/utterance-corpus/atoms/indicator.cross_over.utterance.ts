import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorCrossOverUtterances = [
  { id: 'indicator-cross-over-ema-entry', atomKey: 'indicator.cross_over' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'EMA7 上穿 EMA21 做多，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_over' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-over-rsi-reclaim', atomKey: 'indicator.cross_over' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'RSI14 从 38 下方向上穿回 38 时买入，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_over' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-over-mixed-macd', atomKey: 'indicator.cross_over' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'MACD DIF 上穿 DEA 做多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_over' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-over-zh-15min-ema20-ema60', atomKey: 'indicator.cross_over' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15min，ema20 金叉 ema60 开多，仓位 10%。', expected: { owner: 'trigger' as const, key: 'indicator.cross_over' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'indicator-cross-over-en-ema-crosses-above', atomKey: 'indicator.cross_over' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 4h, ema7 crosses above ema21 enter long, position 10%.', expected: { owner: 'trigger' as const, key: 'indicator.cross_over' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
