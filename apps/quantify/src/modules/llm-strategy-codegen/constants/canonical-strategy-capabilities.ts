export const DEFAULT_INDICATOR_PARAMS = {
  bollingerBands: { period: 20, stdDev: 2 },
  sma: { period: 20 },
  ema: { period: 20 },
  rsi: { period: 14 },
  atr: { period: 14 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
} as const

export const CANONICAL_RULE_KEYS = {
  executionOnStart: 'execution.on_start',
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

export const FIRST_WAVE_TRIGGER_ATOMS = [
  'execution.on_start',
  'price.percent_change',
  'price.range_position_lte',
  'price.range_position_gte',
  'price.breakout_up',
  'price.breakout_down',
  'price.detect.indicator_boundary',
  'indicator.cross_over',
  'indicator.cross_under',
  'indicator.above',
  'indicator.below',
  'bollinger.touch_upper',
  'bollinger.touch_lower',
  'bollinger.touch_middle',
  'oscillator.rsi_gte',
  'oscillator.rsi_lte',
  'trend.direction',
  'market.regime',
  'volatility.state',
] as const

export type FirstWaveTriggerAtom = (typeof FIRST_WAVE_TRIGGER_ATOMS)[number]

export const FIRST_WAVE_STATE_TRIGGER_ATOMS = [
  'trend.direction',
  'market.regime',
  'volatility.state',
] as const

export type FirstWaveStateTriggerAtom = (typeof FIRST_WAVE_STATE_TRIGGER_ATOMS)[number]

export const FIRST_WAVE_FAMILIES = [
  'single-leg',
  'grid.range_rebalance',
  'state-gated',
] as const

export type FirstWaveStrategyFamily = (typeof FIRST_WAVE_FAMILIES)[number]

export const GRID_STRATEGY_FAMILY = 'grid.range_rebalance' as const
