import type { PartialTakeProfitProgramMetadata } from './partial-take-profit'
import type {
  SemanticOrchestrationDataSourceRole,
  SemanticOrchestrationDataSourceSchema,
  SemanticOrchestrationGateEffect,
  SemanticOrchestrationGateTarget,
  SemanticOrchestrationProgramExpirationPolicy,
} from './semantic-state'

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
    /** profit_pct 模式的盈利触发阈值（单位 percent，例如 3 表示 3%） */
    profitThreshold?: number
    /** drawdown_pct 模式的回撤触发阈值（单位 percent） */
    drawdownThreshold?: number
  }
  /**
   * Inert（runtime-no-op）pyramiding metadata：用于把 `position.pyramiding_limit`
   * 约束参数（maxLayers / layerSizing / 关联 price.percent_change 的 profitThreshold）
   * 投射到 IR / 编译脚本文本中，让 staging30 token 报告能从 scriptCode 抽到
   * `3%` / `50%` / `take_profit` 这类数值证据。仅当 rule 同时含 OPEN_LONG / OPEN_SHORT
   * 且无 metadata.addPosition（避免 runtime 把 OPEN 误判为 ADD lifecycle）。
   *
   * 字段语义与 `addPosition` 同义但*绝不被* runtime 消费——`run-decision-programs.ts`
   * 仅读取 `metadata.addPosition`/`reversePosition`/`dcaSchedule`/`partialTakeProfit`，
   * `pyramidingHint` 留作纯展示/审计字段。
   */
  pyramidingHint?: {
    maxLayers?: number
    /** 加仓比例（单位 percent，例如 50 表示每层 50%） */
    layerSizing?: number
    /** profitThreshold：触发加仓的盈利阈值（单位 percent，例如 3 表示 3%） */
    profitThreshold?: number
  }
  dcaSchedule?: {
    maxCount: number
    capitalCap: number
    maxExposurePct?: number
    stateKey: string
    /** triggerMode: 补仓触发方式，如 price_interval / time_interval / signal */
    triggerMode?: string
    /** priceIntervalPct: price_interval 触发阈值百分比，如每跌 5% */
    priceIntervalPct?: number
    /** dropPct: time_interval 模式下用户额外声明的回撤加投阈值（与 priceIntervalPct 互不替代） */
    dropPct?: number
    /** priceIntervalQuote: price_interval 触发阈值绝对价格间隔 */
    priceIntervalQuote?: number
    /** timeIntervalBars: time_interval 触发间隔 bar 数 */
    timeIntervalBars?: number
    /** timeIntervalMs: time_interval 触发间隔毫秒数 */
    timeIntervalMs?: number
    /** exitRule: DCA 退出规则，如跌破前低停止 / 达到止损退出 */
    exitRule?: Record<string, string>
    /** drawdownPerOrderSizing: 与主 leg sizing 不同的回撤加投金额（generic 第二段 sizing 透传） */
    drawdownPerOrderSizing?: { kind: string; value: number; asset?: string }
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
  orchestrationPrograms?: IrOrchestrationProgram[]
  // Phase 5 S2 (#1104): scope.symbol substrate
  orchestrationScopes?: IrOrchestrationScope[]
  // Phase 5 S11 (#1112): scope.leg substrate
  orchestrationLegScopes?: IrOrchestrationLegScope[]
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
    | 'INDICATOR_DIVERGENCE'
    | 'CANDLE_PATTERN'
    | 'CHART_PATTERN'
    | 'LIQUIDITY_SWEEP'
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
  // User-visible trigger threshold for centered-percent-range level sets (e.g. band ±0.4%).
  // Retained alongside the per-step derived spacing so downstream token checks keep the raw threshold.
  triggerPct?: number
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
    | 'externalSignal'
    | 'orderbookImbalance'
    | 'fundingRateCondition'
    | 'openInterestCondition'
    | 'liquidationCondition'
  args: string[]
  params?: Record<string, number | string | boolean>
}

export interface RuntimeRequirements {
  helpers: string[]
  stateKeys: string[]
}

export interface RiskPredicateDef {
  id: string
  kind: 'atrMultipleStop' | 'atrMultipleTakeProfit' | 'atrTrailingStop' | 'rememberedLevelStop' | 'timeStopBars' | 'cooldownBars'
  params: Record<string, number | string | boolean>
  actions?: RiskPredicateActionDef[]
  sourcePath?: string
}

export interface RiskPredicateActionDef {
  kind: 'FORCE_EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'BLOCK_NEW_ENTRY'
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
    sourcePath?: string
    partialTakeProfit?: PartialTakeProfitProgramMetadata
    // Phase 5 S2 (#1104): 多 scope 策略中显式声明该 rule 归属哪个 scope.symbol id
    symbolScopeRef?: string
    // Phase 5 S11 (#1112): 多 leg 策略中显式声明该 rule 归属哪个 scope.leg id
    legScopeRef?: string
    // Phase 5 S3 (#1109): 多周期策略中显式声明该 rule 归属哪个 scope.timeframe id
    timeframeScopeRef?: string
    // Phase 5 S9 (#1110): 显式声明该 rule 归属哪个 scope.dataSource id
    dataSourceScopeRef?: string
    // Phase 5 S10 (#1111): 多 subStrategy 策略中该 rule 归属的 scope.subStrategy id
    subStrategyScopeRef?: string
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
  order?: {
    orderType: 'market' | 'limit'
    limitPrice?: number
    timeInForce?: 'gtc' | 'ioc' | 'fok'
    triggerConditionRef?: string
  }
}

interface OrderProgramBaseDef {
  id: string
  kind: 'LIMIT_LADDER'
  sourcePath?: string
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
  sourcePath?: string
  exprId: string
  // Phase 5 S10 (#1111): target 升级为 union（entry / strategy / subStrategy）
  target: SemanticOrchestrationGateTarget
  // Phase 5 S10 (#1111): effect 扩 'pause_substrategy' | 'switch_substrategy'
  effectWhenFalse: SemanticOrchestrationGateEffect
}

// Phase 5 S7 (#1057): drawdown_block IR —— scope='portfolio'
export interface IrPortfolioDrawdownRisk {
  id: string
  sourcePath?: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number
  effectWhenTriggered: 'block_new_entries'
}

// Phase 5 S8 (#1119): symbol exposure cap IR —— scope='symbol'
export interface IrPortfolioSymbolExposureCapRisk {
  id: string
  sourcePath?: string
  scope: 'symbol'
  mode: 'observe' | 'enforce'
  notionalCapPct: number
  symbolScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'reduce_exposure'
}

// Phase 5 S8 (#1119): subStrategy exposure cap IR —— scope='subStrategy'
export interface IrPortfolioSubStrategyExposureCapRisk {
  id: string
  sourcePath?: string
  scope: 'subStrategy'
  mode: 'observe' | 'enforce'
  notionalCapPct: number
  subStrategyScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'pause_substrategy'
}

// Phase 5 S8 (#1119): IR portfolioRisk union（与 canonical 同形）
//   关键 byte-equal 兜底：旧 IR JSON 缺 `scope` 字段时 evaluator/runtime default 'portfolio'，走 drawdown 分支与 S7 等价
export type IrOrchestrationPortfolioRisk =
  | IrPortfolioDrawdownRisk
  | IrPortfolioSymbolExposureCapRisk
  | IrPortfolioSubStrategyExposureCapRisk

export interface IrOrchestrationProgramGridParams {
  anchorPrice: number
  levelCount: number
  stepPct: number
  lowerBound?: number
  upperBound?: number
}

export interface IrOrchestrationProgramSizing {
  mode: 'fixed_quote' | 'fixed_base' | 'fixed_pct'
  value: number
}

// Phase 5 S5 (#984)
export interface IrOrchestrationProgramDynamicGridParams {
  anchorLookbackBars: number
  anchorSide: 'high' | 'low' | 'mid'
  anchorDriftPct: number
  rebuildMinIntervalSec: number
  levelCount: number
  step: { mode: 'pct' | 'absolute'; value: number }
}

// Phase 5 S6 (#984)
export interface IrOrchestrationProgramAdaptiveGridParams {
  atrPeriod: number
  atrMultiplier: number
  rangeMultiplier: number
  atrDriftPct: number
  rebuildCooldownSec: number
  minStepPct: number
  maxStepPct: number
  levelCount: number
}

export interface IrFixedGridGatedProgram {
  id: string
  sourcePath?: string
  programKind: 'fixed_grid_gated'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  gridParams: IrOrchestrationProgramGridParams
  sizing: IrOrchestrationProgramSizing
}

export interface IrDynamicGridProgram {
  id: string
  sourcePath?: string
  programKind: 'dynamic_grid'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'anchor_on_state_change'
  dynamicGridParams: IrOrchestrationProgramDynamicGridParams
  sizing: IrOrchestrationProgramSizing
}

export interface IrAdaptiveVolatilityGridProgram {
  id: string
  sourcePath?: string
  programKind: 'adaptive_volatility_grid'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'atr_window'
  adaptiveGridParams: IrOrchestrationProgramAdaptiveGridParams
  sizing: IrOrchestrationProgramSizing
}

// Phase 5 S12 (#1118): event_listener IR 形态
//   sourceFeedId — IR 阶段固化 scope.dataSource role='event' 的 feedId 字面量（与 S4 同模式）
//   不带 sizing — 不发限价单
export interface IrEventListenerProgram {
  id: string
  sourcePath?: string
  programKind: 'event_listener'
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep'
  rebuildPolicy: 'static' | 'on_schema_version_bump'
  eventSchemaRef: SemanticOrchestrationDataSourceSchema
  sourceFeedId: string
  permissionScope: string
  idempotencyKey: { fieldPath: string }
  dedupWindowMs: number
  expirationTtlMs: number
  expirationPolicy: SemanticOrchestrationProgramExpirationPolicy
}

export type IrExecutionProgramKind = 'twap' | 'dca' | 'martingale' | 'rebalance' | 'iceberg'

export interface IrExecutionProgram {
  id: string
  sourcePath?: string
  programKind: IrExecutionProgramKind
  activeWhenExprId: string
  onDeactivate: 'cancel' | 'keep' | 'close'
  rebuildPolicy: 'static'
  params: Record<string, unknown>
}

export type IrOrchestrationProgram =
  | IrFixedGridGatedProgram
  | IrDynamicGridProgram
  | IrAdaptiveVolatilityGridProgram
  | IrEventListenerProgram
  | IrExecutionProgram

// Phase 5 S2 (#1104): scope.symbol substrate IR
export interface IrSymbolScope {
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}

// Phase 5 S11 (#1112): scope.leg substrate IR
export interface IrOrchestrationLegSizing {
  mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio' | 'fixed_base'
  value: number
  pairedLegId?: string
}

export interface IrOrchestrationLegScope {
  id: string
  scopeKind: 'leg'
  legId: string
  direction: 'long' | 'short'
  instrumentRef: string
  legSizing?: IrOrchestrationLegSizing
  syncTriggerRequired?: boolean
}

// Phase 5 S3 (#1109): scope.timeframe substrate IR
export interface IrOrchestrationTimeframeScope {
  id: string
  scopeKind: 'timeframe'
  primaryTimeframe: string
  requiredTimeframes: readonly string[]
  alignmentPolicy: 'strict' | 'tolerant'
}

// Phase 5 S9 (#1110): scope.dataSource substrate IR
export interface IrOrchestrationDataSourceScope {
  id: string
  scopeKind: 'dataSource'
  role: SemanticOrchestrationDataSourceRole
  feedId: string
  schemaRef: SemanticOrchestrationDataSourceSchema
}

// Phase 5 S10 (#1111): scope.subStrategy substrate IR
export interface IrSubStrategyScope {
  id: string
  scopeKind: 'subStrategy'
  subStrategyId: string
  subStrategyLabel?: string
  positionHandlingOnDeactivate: 'close' | 'keep'
  orderHandlingOnDeactivate: 'cancel' | 'keep'
}

// Phase 5 S10 (#1111): IR scope union — discriminator scopeKind
export type IrOrchestrationScope =
  | IrSymbolScope
  | IrOrchestrationLegScope
  | IrOrchestrationTimeframeScope
  | IrOrchestrationDataSourceScope
  | IrSubStrategyScope

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
  sourcePath?: string
}

// P4-4 critic round 1 A3 修复：reclaimBars 默认值集中定义，避免 builder 与 IR compiler
// 各自维护副本造成 silent-rename divergence。
export const LIQUIDITY_SWEEP_DEFAULT_RECLAIM_BARS = 3
