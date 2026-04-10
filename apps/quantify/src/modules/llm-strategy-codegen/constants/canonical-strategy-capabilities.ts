export const DEFAULT_INDICATOR_PARAMS = {
  bollingerBands: { period: 20, stdDev: 2 },
  sma: { period: 20 },
  ema: { period: 20 },
  rsi: { period: 14 },
  atr: { period: 14 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
} as const

export const CANONICAL_RULE_KEYS = {
  bollingerUpperBreak: 'bollinger.upper_break',
  bollingerLowerBreak: 'bollinger.lower_break',
  bollingerMiddleRevert: 'bollinger.middle_revert',
  bollingerBarsOutside: 'bollinger.bars_outside',
  movingAverageGoldenCross: 'ma.golden_cross',
  movingAverageDeathCross: 'ma.death_cross',
  rsiThresholdLte: 'rsi.threshold_lte',
  rsiThresholdGte: 'rsi.threshold_gte',
  rsiCrossOver: 'rsi.cross_over',
  rsiCrossUnder: 'rsi.cross_under',
  macdGoldenCross: 'macd.golden_cross',
  macdDeathCross: 'macd.death_cross',
  positionLossPct: 'position_loss_pct',
} as const

export type CanonicalRuleKeyValue = (typeof CANONICAL_RULE_KEYS)[keyof typeof CANONICAL_RULE_KEYS]
