export type LogicNodeJoin = 'AND' | 'OR'

export interface LogicConditionNode {
  id: string
  subject: string
  operator: string
  value: string
  join?: LogicNodeJoin
}

export interface LogicActionNode {
  id: string
  action: 'BUY' | 'SELL' | 'CLOSE'
  target: string
  amount: string
}

export interface StrategyLogicGraph {
  version: number
  status: 'draft' | 'confirmed'
  trigger: LogicConditionNode[]
  actions: LogicActionNode[]
  risk: string[]
  meta: {
    exchange: 'binance' | 'okx'
    symbol: string
    timeframe: string
    positionPct: number
  }
}

