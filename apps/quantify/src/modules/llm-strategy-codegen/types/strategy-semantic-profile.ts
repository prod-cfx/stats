import type { CanonicalAction, CanonicalIndicatorKind, CanonicalSizingMode } from './canonical-strategy-spec'

export interface StrategySemanticIndicator {
  kind: CanonicalIndicatorKind
  params: Record<string, number | string | boolean>
}

export type StrategySemanticRuleKey =
  | 'bollinger.upper_break'
  | 'bollinger.lower_break'
  | 'bollinger.middle_revert'
  | 'bollinger.bars_outside'
  | 'ma.golden_cross'
  | 'ma.death_cross'
  | 'position_loss_pct'

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
