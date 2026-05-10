import type { ActionDef, IrOrchestrationLegScope, IrOrchestrationProgram, IrOrchestrationScope, LevelSetDef, OrderProgram, PositionLifecycleActionMetadata, RiskGuard, RiskPredicateDef, RuntimeRequirements, SeriesDef, PredicateDef } from './canonical-strategy-ir'

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
    fillPolicy: 'next_bar_open' | 'same_bar_close' | 'intra_bar_limit_match' | 'exchange_order_update'
    defaultOrderType: 'market' | 'limit'
    allowPartialFill: boolean
  }
  dataRequirements: {
    warmupBars: number
    maxLookback: number
    requiredTimeframes: string[]
  }
  runtimeRequirements?: RuntimeRequirements
  exprPool: ExprNode[]
  guards: GuardProgramNode[]
  riskPredicates?: RiskPredicateProgramNode[]
  decisionPrograms: DecisionProgramNode[]
  orderPrograms: OrderProgramNode[]
  orchestrationPrograms?: IrOrchestrationProgram[]
  // Phase 5 S2 (#1104): scope.symbol substrate
  orchestrationScopes?: IrOrchestrationScope[]
  // Phase 5 S11 (#1112): scope.leg substrate
  orchestrationLegScopes?: IrOrchestrationLegScope[]
  topology: {
    exprOrder: string[]
    guardOrder: string[]
    riskPredicateOrder?: string[]
    decisionOrder: string[]
    orderProgramOrder: string[]
  }
}

export interface ExprNode {
  id: string
  sourceRef: string
  nodeType: 'series' | 'level_set' | 'predicate'
  payload: SeriesDef | LevelSetDef | PredicateDef
  deps: string[]
}

export interface GuardProgramNode {
  id: string
  sourceRef: string
  payload: RiskGuard
}

export interface RiskPredicateProgramNode {
  id: string
  sourceRef: string
  payload: RiskPredicateDef
}

export interface DecisionProgramNode {
  id: string
  sourceRef: string
  phase: 'entry' | 'exit' | 'rebalance'
  when: string
  priority: number
  cooldownBars?: number
  actions: ActionDef[]
  metadata?: PositionLifecycleActionMetadata & {
    // Phase 5 S2 (#1104): 多 scope 策略中的 symbolScopeRef 透传
    symbolScopeRef?: string
    // Phase 5 S11 (#1112): 多 leg 策略中的 legScopeRef 透传
    legScopeRef?: string
    // Phase 5 S3 (#1109): 多周期策略中的 timeframeScopeRef 透传
    timeframeScopeRef?: string
    // Phase 5 S9 (#1110): 多 dataSource scope 策略中的 dataSourceScopeRef 透传
    dataSourceScopeRef?: string
  }
}

export interface OrderProgramNode {
  id: string
  sourceRef: string
  payload: OrderProgram
}
