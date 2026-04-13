export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'
export type CanonicalRiskRuleSideScope = Exclude<CanonicalRuleSideScope, 'flat'>

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  semanticScope?: 'market' | 'position' | 'portfolio'
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
}

export type CanonicalConditionNode = CanonicalConditionAtom | CanonicalConditionGroup

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
  }
  params?: Record<string, number | string | boolean>
}

export interface CanonicalRuleV2 {
  id: string
  phase: CanonicalRulePhase
  sideScope?: CanonicalRuleSideScope
  priority: number
  cooldownBars?: number
  condition: CanonicalConditionNode
  actions: CanonicalRuleAction[]
  metadata?: Record<string, unknown>
}

export interface CanonicalStrategySpecV2 {
  version: 2
  market: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string | null
    marketType: 'spot' | 'perp'
    defaultTimeframe?: string | null
    timeframe?: string | null
  }
  indicators: Array<{
    kind: 'bollingerBands' | 'sma' | 'ema' | 'rsi' | 'atr' | 'macd' | 'custom'
    params: Record<string, number | string | boolean>
  }>
  sizing: {
    mode: 'RATIO' | 'QUOTE' | 'QTY'
    value: number
  } | null
  executionPolicy: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN'
  }
  dataRequirements: {
    requiredTimeframes: string[]
  }
  rules: CanonicalRuleV2[]
}
