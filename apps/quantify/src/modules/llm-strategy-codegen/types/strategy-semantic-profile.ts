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

export interface StrategySemanticProfile {
  indicators: StrategySemanticIndicator[]
  actions: CanonicalAction[]
  ruleMappings: StrategySemanticRuleMapping[]
  sizing: {
    mode: CanonicalSizingMode
    value: number
  } | null
  requiredParams: string[]
  fallbackDetected: boolean
}
