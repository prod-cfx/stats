import type { QuantSizing } from '@/app/[lng]/ai-quant/semantic-sizing'

type LogicNodeJoin = 'AND' | 'OR'

interface LogicConditionNode {
  id: string
  subject: string
  operator: string
  value: string
  join?: LogicNodeJoin
}

interface LogicActionNode {
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
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    timeframe: string
    positionPct: number
    sizing?: QuantSizing
    positionSizing?: string
    executionTags?: string[]
  }
}
