import type { StrategyNormalizedIntent } from './strategy-normalized-intent'
import type { SemanticExpressionOperand, SemanticExpressionOperator } from './semantic-state'

export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance' | 'gate'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'
export type CanonicalRiskRuleSideScope = Exclude<CanonicalRuleSideScope, 'flat'>

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  semanticScope?: 'market' | 'position' | 'portfolio'
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
    | 'GT' | 'LT'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
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

export interface CanonicalRuleV2 {
  id: string
  phase: CanonicalRulePhase
  sideScope?: CanonicalRuleSideScope
  priority: number
  cooldownBars?: number
  condition: CanonicalConditionNode
  actions: CanonicalRuleAction[]
  metadata?: Record<string, unknown> & {
    normalized?: CanonicalRuleNormalizedMetadata
  }
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
  metadata?: {
    normalized?: CanonicalStrategySpecNormalizedMetadata
  }
}
