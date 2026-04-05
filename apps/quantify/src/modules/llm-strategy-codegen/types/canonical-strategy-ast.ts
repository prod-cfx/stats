import type { ActionDef, OrderProgram, RiskGuard, SeriesDef, PredicateDef } from './canonical-strategy-ir'

export interface StrategyAstV1 {
  astVersion: 'csa.v1'
  manifest: {
    irVersion: 'csi.v1'
    irHash: `sha256:${string}`
    specHash: `sha256:${string}`
    compileVersion: 'compiler.v1'
    structuralDigest: `sha256:${string}`
  }
  executionModel: {
    venue: 'binance' | 'okx' | 'hyperliquid'
    instrumentType: 'spot' | 'perpetual'
    symbol: string
    primaryTimeframe: string
    timeframeAlignment: 'strict'
    signalEvaluation: 'bar_close'
    fillPolicy: 'next_bar_open' | 'same_bar_close' | 'intra_bar_limit_match'
    defaultOrderType: 'market' | 'limit'
    allowPartialFill: boolean
  }
  dataRequirements: {
    warmupBars: number
    maxLookback: number
    requiredTimeframes: string[]
  }
  exprPool: ExprNode[]
  guards: GuardProgramNode[]
  decisionPrograms: DecisionProgramNode[]
  orderPrograms: OrderProgramNode[]
  topology: {
    exprOrder: string[]
    guardOrder: string[]
    decisionOrder: string[]
    orderProgramOrder: string[]
  }
}

export interface ExprNode {
  id: string
  sourceRef: string
  nodeType: 'series' | 'predicate'
  payload: SeriesDef | PredicateDef
  deps: string[]
}

export interface GuardProgramNode {
  id: string
  sourceRef: string
  payload: RiskGuard
}

export interface DecisionProgramNode {
  id: string
  sourceRef: string
  phase: 'entry' | 'exit' | 'rebalance'
  when: string
  priority: number
  actions: ActionDef[]
}

export interface OrderProgramNode {
  id: string
  sourceRef: string
  payload: OrderProgram
}
