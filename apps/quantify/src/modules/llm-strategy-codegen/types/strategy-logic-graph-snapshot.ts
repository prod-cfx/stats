export type GraphJoin = 'AND' | 'OR'
export type GraphTriggerPhase = 'entry' | 'exit' | 'rebalance'
export type GraphAction = 'BUY' | 'SELL' | 'CLOSE'

export interface StrategyLogicGraphSnapshot {
  version: number
  status: 'confirmed'
  trigger: StrategyLogicGraphTriggerNode[]
  actions: StrategyLogicGraphActionNode[]
  risk: string[]
  meta: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    timeframe: string
    positionPct: number
    executionTags: string[]
  }
}

export interface StrategyLogicGraphTriggerNode {
  id: string
  phase: GraphTriggerPhase
  operator: string
  join?: GraphJoin
}

export interface StrategyLogicGraphActionNode {
  id: string
  action: GraphAction
  target: string
  amount: string
}

export type ParsedOperatorNode
  = { kind: 'IDENT'; name: string }
    | { kind: 'NUMBER'; value: number }
    | { kind: 'CALL'; name: string; args: ParsedOperatorNode[] }
