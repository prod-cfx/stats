import type { CanonicalAction, CanonicalIndicatorKind, CanonicalSizingMode } from './canonical-strategy-spec'

export interface StrategySemanticIndicator {
  kind: CanonicalIndicatorKind
  params: Record<string, number | string | boolean>
}

export type StrategySemanticRuleKey =
  | 'execution.on_start'
  | 'price.change_pct'
  | 'bollinger.upper_break'
  | 'bollinger.lower_break'
  | 'bollinger.middle_revert'
  | 'bollinger.bars_outside'
  | 'breakout.channel_high_break'
  | 'breakout.channel_low_break'
  | 'grid.range_rebalance'
  | 'ma.golden_cross'
  | 'ma.death_cross'
  | 'rsi.threshold_lte'
  | 'rsi.threshold_gte'
  | 'rsi.cross_over'
  | 'rsi.cross_under'
  | 'macd.golden_cross'
  | 'macd.death_cross'
  | 'position_loss_pct'
  | 'risk.atr_multiple_stop'
  | 'risk.atr_multiple_take_profit'
  | 'risk.remembered_level_stop'
  | 'risk.take_profit_pct'
  | 'risk.trailing_stop_pct'
  | 'risk.cooldown_bars'
  | 'risk.time_stop_bars'

export interface StrategySemanticRuleMapping {
  key: StrategySemanticRuleKey
  action: CanonicalAction
}

export interface StrategySemanticRuleProfile {
  key: StrategySemanticRuleKey
  action: CanonicalAction
  phase: 'entry' | 'exit' | 'risk' | 'rebalance'
  sideScope: 'long' | 'short' | 'both' | 'flat'
}

export type StrategySemanticSizingSource =
  | 'literal'
  | 'positionPct_normalized'
  | 'positionPct_raw'
  | 'unknown'

export interface StrategySemanticSizing {
  mode: CanonicalSizingMode
  value: number | null
  source: StrategySemanticSizingSource
}

export interface StrategySemanticProfile {
  indicators: StrategySemanticIndicator[]
  actions: CanonicalAction[]
  ruleMappings: StrategySemanticRuleMapping[]
  rules: StrategySemanticRuleProfile[]
  sizing: StrategySemanticSizing | null
  requiredParams: string[]
  fallbackDetected: boolean
}
