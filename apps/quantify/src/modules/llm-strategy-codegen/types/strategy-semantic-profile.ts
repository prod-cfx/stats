import type { CanonicalAction, CanonicalIndicatorKind, CanonicalSizingMode } from './canonical-strategy-spec'

export interface StrategySemanticIndicator {
  kind: CanonicalIndicatorKind
  params: Record<string, number | string | boolean>
}

export type StrategySemanticRuleKey =
  | 'bollinger.upper_break'
  | 'bollinger.lower_break'
  | 'bollinger.middle_revert'

export interface StrategySemanticRuleMapping {
  key: StrategySemanticRuleKey
  action: CanonicalAction
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
  sizing: StrategySemanticSizing | null
  requiredParams: string[]
  fallbackDetected: boolean
}
