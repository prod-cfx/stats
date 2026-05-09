import type { PartialTakeProfitProgramMetadata } from './partial-take-profit'

export type { PartialTakeProfitProgramMetadata } from './partial-take-profit'

export type HashString = `sha256:${string}`

export interface PositionLifecycleActionMetadata {
  reversePosition?: {
    fromSide: 'long' | 'short'
    toSide: 'long' | 'short'
    sameBarPolicy: 'allow' | 'next_bar_only'
    sizingSource: 'current_position' | 'fixed' | 'position_sizing'
  }
  addPosition?: {
    maxLayers?: number
    maxExposurePct?: number
    stateKey: string
    /** addMode 决定 runtime 触发条件：signal_confirm / profit_pct / drawdown_pct */
    addMode?: string
    /** addRatio 相对原仓位的加仓比例 (0, 1] */
    addRatio?: number
  }
  dcaSchedule?: {
    maxCount: number
    capitalCap: number
    maxExposurePct?: number
    stateKey: string
  }
}

export interface CanonicalStrategyIrV1 {
  irVersion: 'csi.v1'
  source: {
    graphVersion: number
    graphDigest: HashString
    specHash: HashString
  }
  market: {
    venue: 'binance' | 'okx' | 'hyperliquid'
    instrumentType: 'spot' | 'perpetual'
    symbol: string
    timeframes: string[]
    priceFeed: 'close' | 'hlc3' | 'ohlc4'
  }
  portfolio: {
    positionMode: 'long_only' | 'short_only' | 'long_short'
    sizing: {
      mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
      value: number
      asset?: string
    }
    maxConcurrentPositions: number
    allowPyramiding: boolean
    maxPyramidingLayers: number
  }
  dataRequirements: {
    warmupBars: number
    maxLookback: number
    requiredTimeframes: string[]
  }
  signalCatalog: {
    series: SeriesDef[]
    levelSets: LevelSetDef[]
    predicates: PredicateDef[]
  }
  runtimeRequirements?: RuntimeRequirements
  ruleBlocks: RuleBlock[]
  orderPrograms: OrderProgram[]
  orchestrationGates?: IrOrchestrationGate[]
  orchestrationPortfolioRisks?: IrOrchestrationPortfolioRisk[]
  riskPolicy: {
    guards: RiskGuard[]
    riskPredicates?: RiskPredicateDef[]
  }
  executionPolicy: {
    signalEvaluation: 'bar_close'
    fillPolicy: 'next_bar_open' | 'same_bar_close' | 'intra_bar_limit_match' | 'exchange_order_update'
    timeframeAlignment: 'strict'
    orderTypeDefault: 'market' | 'limit'
    timeInForce: 'gtc' | 'ioc' | 'fok'
    allowPartialFill: boolean
  }
}

export interface SeriesDef {
  id: string
  kind:
    | 'PRICE'
    | 'DEPLOYMENT_PRICE'
    | 'BAR_INDEX'
    | 'CONST'
    | 'MARKET_REGIME'
    | 'TREND_DIRECTION'
    | 'VOLATILITY_STATE'
    | 'PRICE_CHANGE_PCT'
    | 'RANGE_POSITION_PCT'
    | 'POSITION_AVG_PRICE'
    | 'POSITION_PNL_PCT'
    | 'VOLUME'
    | 'SMA_VOLUME'
    | 'BOLLINGER_BARS_OUTSIDE'
    | 'SMA'
    | 'EMA'
    | 'RSI'
    | 'ATR'
    | 'MACD_LINE'
    | 'MACD_SIGNAL'
    | 'HIGHEST_HIGH'
    | 'LOWEST_LOW'
    | 'POSITION_BARS_HELD'
    | 'STDDEV'
    | 'UPPER_BAND'
    | 'MID_BAND'
    | 'LOWER_BAND'
    | 'IN_TIME_WINDOW'
  timeframe?: string
  field?: 'open' | 'high' | 'low' | 'close'
  offsetBars?: number
  inputs?: string[]
  params?: Record<string, number | string>
  value?: number | string
  timezone?: string
  windows?: ReadonlyArray<{ daysOfWeek?: readonly number[]; start: string; end: string }>
}

export interface LevelSetDef {
  id: string
  kind: 'ARITHMETIC_LEVEL_SET' | 'GEOMETRIC_LEVEL_SET'
  anchorRef: string
  spacing: {
    mode: 'pct' | 'absolute' | 'atr_multiple'
    value: number
  }
  levelsPerSide: {
    down: number
    up: number
  }
  hardBounds?: {
    lowerRef: string
    upperRef: string
  }
}

export interface PredicateDef {
  id: string
  kind:
    | 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'
    | 'CROSS_OVER' | 'CROSS_UNDER'
    | 'TOUCH_LEVEL_UP' | 'TOUCH_LEVEL_DOWN'
    | 'WITHIN_LEVEL_SET'
    | 'AND' | 'OR' | 'NOT'
    | 'allOf' | 'anyOf'
    | 'sequence'
    | 'compare'
    | 'cross'
  args: string[]
  params?: Record<string, number | string | boolean>
}

export interface RuntimeRequirements {
  helpers: string[]
  stateKeys: string[]
}

export interface RiskPredicateDef {
  id: string
  kind: 'atrMultipleStop' | 'atrMultipleTakeProfit' | 'rememberedLevelStop' | 'timeStopBars'
  params: Record<string, number | string | boolean>
  actions?: RiskPredicateActionDef[]
}

export interface RiskPredicateActionDef {
  kind: 'FORCE_EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
}

export interface RuleBlock {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  when: string
  priority: number
  cooldownBars?: number
  guardRefs?: string[]
  actions: ActionDef[]
  metadata?: {
    partialTakeProfit?: PartialTakeProfitProgramMetadata
  } & PositionLifecycleActionMetadata
}

export interface QuantityDef {
  mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
  value: number
  asset?: string
}

export interface ActionDef {
  kind:
    | 'OPEN_LONG' | 'CLOSE_LONG'
    | 'OPEN_SHORT' | 'CLOSE_SHORT'
    | 'REDUCE_LONG' | 'REDUCE_SHORT'
    | 'ADD_LONG' | 'ADD_SHORT'
  quantity: QuantityDef
}

interface OrderProgramBaseDef {
  id: string
  kind: 'LIMIT_LADDER'
  activeWhen?: string
  side: 'buy' | 'sell'
  sidePolicy: 'spot_grid' | 'perp_long' | 'perp_short' | 'perp_neutral'
  tickPolicy: 'round' | 'floor' | 'ceil'
  quantity: QuantityDef
  orderType: 'limit'
  timeInForce: 'gtc'
  recycleOnFill: boolean
  pairingPolicy: 'adjacent_level'
  cancelScope: 'program_orders'
  maxWorkingOrders: number
  group: string
}

export interface LevelSetOrderProgramDef extends OrderProgramBaseDef {
  priceSource: 'level_set'
  levelSetRef: string
  offset?: never
}

export interface OffsetOrderProgramDef extends OrderProgramBaseDef {
  priceSource: 'offset_from_price'
  levelSetRef?: never
  offset: {
    basis: 'pct' | 'absolute' | 'atr_multiple'
    value: number
    anchorRef: string
  }
}

export type OrderProgramDef = LevelSetOrderProgramDef | OffsetOrderProgramDef

export type OrderProgram = OrderProgramDef

export interface IrOrchestrationGate {
  id: string
  exprId: string
  target: { phase: 'entry', sideScope?: 'long' | 'short' | 'both' }
  effectWhenFalse: 'block_new_entries'
}

export interface IrOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

export interface RiskGuard {
  id: string
  kind:
    | 'STOP_LOSS_PCT'
    | 'TAKE_PROFIT_PCT'
    | 'MAX_SINGLE_LOSS_PCT'
    | 'MAX_DRAWDOWN_PCT'
    | 'MAX_POSITION_PCT'
    | 'TRAILING_STOP_PCT'
    | 'HARD_PRICE_STOP'
    | 'EXPRESSION_GUARD'
  scope: 'position' | 'strategy' | 'order_program'
  appliesTo?: 'long' | 'short' | 'both'
  value?: number
  referenceRef?: string
  predicateRef?: string
  onBreach: 'BLOCK_NEW_ENTRY' | 'FORCE_EXIT' | 'HALT_STRATEGY' | 'CANCEL_ORDER_PROGRAMS'
}
