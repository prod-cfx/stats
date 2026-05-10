import type { PartialTakeProfitProgramMetadata } from './partial-take-profit'
import type { PositionLifecycleActionMetadata } from './canonical-strategy-ir'
import type { StrategyNormalizedIntent } from './strategy-normalized-intent'
import type { SemanticExpressionOperand, SemanticExpressionOperator } from './semantic-state'

export type { PartialTakeProfitProgramMetadata } from './partial-take-profit'

export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance' | 'gate'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'
export type CanonicalRiskRuleSideScope = Exclude<CanonicalRuleSideScope, 'flat'>

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  semanticScope?: 'market' | 'position' | 'portfolio'
  predicateForm?: 'legacy' | 'generic'
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
    | 'GT' | 'LT'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
  predicateForm?: 'legacy' | 'generic'
}

export interface CanonicalExpressionCondition {
  kind: 'expression'
  op: SemanticExpressionOperator
  left: SemanticExpressionOperand
  right: SemanticExpressionOperand
}

export type CanonicalConditionNode = CanonicalConditionAtom | CanonicalConditionGroup | CanonicalExpressionCondition

export type CanonicalRuleActionType =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'REDUCE_LONG'
  | 'REDUCE_SHORT'
  | 'ADD_LONG'
  | 'ADD_SHORT'
  | 'FORCE_EXIT'
  | 'BLOCK_NEW_ENTRY'

export interface CanonicalRuleAction {
  type: CanonicalRuleActionType
  sizing?: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
    asset?: string
  }
  params?: Record<string, number | string | boolean>
}

export interface CanonicalRuleNormalizedMetadata {
  source: 'normalized-intent'
  triggerKeys?: string[]
  gateKeys?: string[]
  actionKeys?: string[]
  family?: StrategyNormalizedIntent['families'][number]
}

export interface CanonicalStrategySpecNormalizedMetadata {
  source: 'normalized-intent'
  semanticViewSource: 'normalized-canonical-truth'
  intent: StrategyNormalizedIntent
}

export interface CanonicalRuleMetadata extends PositionLifecycleActionMetadata {
  [key: string]: unknown
  normalized?: CanonicalRuleNormalizedMetadata
  partialTakeProfit?: PartialTakeProfitProgramMetadata
  // Phase 5 S2 (#1104): 多 scope 策略中显式声明该 rule 归属哪个 scope.symbol id
  // 仅在 spec.orchestration.scopes.length >= 1 时由 builder 透传；单/0 scope 不输出
  symbolScopeRef?: string
}

export interface CanonicalRuleV2 {
  id: string
  phase: CanonicalRulePhase
  sideScope?: CanonicalRuleSideScope
  priority: number
  cooldownBars?: number
  condition: CanonicalConditionNode
  actions: CanonicalRuleAction[]
  metadata?: CanonicalRuleMetadata
}

export interface CanonicalOrchestrationGate {
  id: string
  target: { phase: 'entry', sideScope?: 'long' | 'short' | 'both' }
  activeWhen: CanonicalConditionNode
  effectWhenFalse: 'block_new_entries'
}

export interface CanonicalOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

export interface CanonicalOrchestrationProgramGridParams {
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
}

export interface CanonicalOrchestrationProgramSizing {
  mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'
  value: number
}

// Phase 5 S5 (#984): dynamic_grid program param block
export interface CanonicalOrchestrationProgramDynamicGridParams {
  anchorLookbackBars: number
  anchorSide: 'high' | 'low' | 'mid'
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  levelCount: number
  step: { mode: 'pct' | 'absolute'; value: number }
}

// Phase 5 S6 (#984): adaptive_volatility_grid program param block
export interface CanonicalOrchestrationProgramAdaptiveGridParams {
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  atrDriftPct: number
  rebuildCooldownSec: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
}

export interface CanonicalFixedGridGatedProgram {
  id: string
  programKind: 'fixed_grid_gated'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  gridParams: CanonicalOrchestrationProgramGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

export interface CanonicalDynamicGridProgram {
  id: string
  programKind: 'dynamic_grid'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'anchor_on_state_change'
  dynamicGridParams: CanonicalOrchestrationProgramDynamicGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

export interface CanonicalAdaptiveVolatilityGridProgram {
  id: string
  programKind: 'adaptive_volatility_grid'
  activeWhenRef: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'atr_window'
  adaptiveGridParams: CanonicalOrchestrationProgramAdaptiveGridParams
  sizing: CanonicalOrchestrationProgramSizing
}

export type CanonicalOrchestrationProgram =
  | CanonicalFixedGridGatedProgram
  | CanonicalDynamicGridProgram
  | CanonicalAdaptiveVolatilityGridProgram

// Phase 5 S2 (#1104): scope.symbol substrate
export interface CanonicalOrchestrationScope {
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}

export interface CanonicalStrategySpecV2 {
  version: 2
  market: {
    exchange: 'binance' | 'okx' | 'hyperliquid' | null
    symbol: string | null
    marketType: 'spot' | 'perp' | null
    defaultTimeframe?: string | null
    timeframe?: string | null
    timeframes?: string[]
  }
  indicators: Array<{
    kind: 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd' | 'custom'
    params: Record<string, number | string | boolean>
  }>
  sizing: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
    asset?: string
  } | null
  executionPolicy: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN'
  }
  dataRequirements: {
    requiredTimeframes: string[]
  }
  rules: CanonicalRuleV2[]
  orchestration?: {
    gates?: CanonicalOrchestrationGate[]
    portfolioRisks?: CanonicalOrchestrationPortfolioRisk[]
    programs?: CanonicalOrchestrationProgram[]
    // Phase 5 S2 (#1104)
    scopes?: CanonicalOrchestrationScope[]
  }
  metadata?: {
    normalized?: CanonicalStrategySpecNormalizedMetadata
  }
}
