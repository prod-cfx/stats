import type { Bar } from './script-engine/helpers'
import type { LegTimeframeData, StrategyHelpers, StrategyParamsNormalized } from './script-engine/helpers/helpers.types'

export type StrategyAction =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'ADJUST_POSITION'
  | 'NOOP'

export type StrategySizeMode = 'QUOTE' | 'RATIO' | 'QTY'

export interface StrategyDecisionSize {
  mode: StrategySizeMode
  value: number
}

export interface StrategyDecisionV1 {
  action: StrategyAction
  size?: StrategyDecisionSize
  adjustMode?: 'TARGET' | 'DELTA'
  confidence?: number
  reason?: string
  risk?: {
    stopLoss?: number
    takeProfit?: number
    maxDrawdown?: number
  }
  meta?: Record<string, unknown>
}

export interface StrategyExecutionContextV1 extends Record<string, any> {
  timestamp?: number
  paramsNormalized?: StrategyParamsNormalized
  params?: Record<string, unknown> | null
  symbol?: string
  /**
   * Phase 5 S2 (#1104): 多 scope.symbol 策略中当前激活的 scope id
   * 由 backtest-strategy-adapter / signal-generator fan-out wrapper 注入
   * 单/0 scope 策略时被忽略
   */
  activeSymbolScopeId?: string
  /**
   * Phase 5 S2 follow-up (#1108): per-scope 仓位映射（caller 端可选注入）
   *   key = scope.id；value = 该 scope 当前的 position 视图
   *   buildScopeIteration 优先消费此字段覆盖 ctx.position；缺失时沿用 ctx.position
   *   live 端实时 per-scope position feed 由 follow-up 接入；当前 substrate 接口先就绪
   */
  positionsBySymbolScope?: Record<string, StrategyExecutionContextV1['position']>
  /**
   * Phase 5 S10 (#1111) + follow-up (#1113): 多 scope.subStrategy 策略中当前激活的 sub scope id
   * 由 backtest-strategy-adapter / signal-generator 的 sub fan-out wrapper（按 cross-bar state）注入
   * 单/0 sub 策略时被忽略
   */
  activeSubStrategyScopeId?: string
  /**
   * Phase 5 S10 follow-up (#1113): per-sub 仓位映射（caller 端可选注入）
   *   key = sub scope.id；value = 该 sub 当前持仓视图
   *   buildSubStrategyScopeIteration 优先消费此字段覆盖 ctx.position；缺失时沿用 ctx.position
   *   live 端实时 per-sub position feed 由 follow-up 接入；当前 substrate 接口先就绪
   */
  positionsBySubStrategyScope?: Record<string, StrategyExecutionContextV1['position']>
  /**
   * Phase 5 S3 (#1109): scope.timeframe substrate 数据对齐状态
   * key 是 timeframe identifier ('1m'|'5m'|'15m'|...)；val 是 caller 已收 bar 状态。
   * 单周期 / 无 scope.timeframe 节点策略不注入；runtime 自动跳过 alignment 检查。
   * 字段事实：lastClosedBarTs 是毫秒（与 packages/shared Bar.timestamp 同源）。
   */
  timeframeBarStatus?: Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }>
  /**
   * Phase 5 S9 (#1110): 多 scope.dataSource 策略 caller 注入的 feed 状态映射
   *   key   = feedId（与 spec.orchestration.scopes[i].feedId 一一对应）
   *   value = { schema, permissionGranted, hasData }
   * 0 个 scope.dataSource 策略不读；≥1 时缺该字段触发 fail-closed.feeds_unprovided
   * 注入路径由 follow-up issue 跟踪
   */
  dataSourceFeeds?: Readonly<Record<string, {
    schema: 'ohlcv' | 'orderbook' | 'liquidation' | 'webhook_event'
    permissionGranted: boolean
    hasData: boolean
  }>>
  /**
   * Phase 5 S12 (#1118): event_listener program 事件入口（按 feedId 索引）。
   * - backtest：fixture 显式注入预录事件流；上层不保证 ts 排序，runtime 内做 stable-sort（plan G2）
   * - live：S12 read-only — 字段全程 undefined（视为空数组），真实 webhook ingestion follow-up
   * - 与 ctx.dataSourceFeeds 一致性：runtime 不做交叉校验（permission/schema 在 readiness 已守门）
   */
  eventInbox?: Readonly<Record<string, ReadonlyArray<{
    readonly id: string
    readonly ts: number
    readonly payload: Readonly<Record<string, unknown>>
  }>>>
  /**
   * Phase 5 S12 (#1118): event_listener schemaVersion 通道（按 feedId 索引）。
   * 单调递增整数；caller 在 schema 升级时 bump（live config 路径或 fixture 显式）。
   * runtime 仅与 prev.schemaVersion 比 `>`；S12 不主动 bump，live 路径 follow-up。
   */
  eventSchemaVersion?: Readonly<Record<string, number>>
  timeframe?: string
  currentPrice?: number
  marketRegime?: string
  trendDirection?: string
  volatilityState?: string
  position?: {
    side?: 'long' | 'short' | 'flat'
    qty?: number
    avgEntryPrice?: number
    entryPrice?: number
    avgPrice?: number
    notional?: number
    notionalValue?: number
    marketValue?: number
    value?: number
    exposurePct?: number
    positionPct?: number
    notionalPct?: number
    exposurePercent?: number
    positionPercent?: number
    notionalPercent?: number
    highestPriceSinceEntry?: number
    peakPriceSinceEntry?: number
    peakPrice?: number
    maxPriceSinceEntry?: number
    lowestPriceSinceEntry?: number
    troughPriceSinceEntry?: number
    troughPrice?: number
    minPriceSinceEntry?: number
  }
  accountEquity?: number
  /**
   * 账户级回撤百分比（0..100 浮点，正数）
   * 公式：(peakEquity - currentEquity) / peakEquity * 100；equity 增长时为 0
   * 与 apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts:1970 同公式
   * Phase 5 S7 portfolioRisk.drawdown_block evaluator 消费此字段
   */
  accountDrawdownPct?: number
  semanticRuntimeState?: Record<string, Record<string, unknown>>
  indicators?: Record<string, number>
  bars?: Bar[]
  execution?: {
    timeframe: string
    cooldownMinutes?: number
  }
  legs?: Array<{
    id: string
    symbol: string
    role: 'primary' | 'hedge' | 'context'
    description?: string
  }>
  dataRequirements?: Record<string, string[]>
  data?: Record<string, Record<string, LegTimeframeData>>
  helpers?: StrategyHelpers
}

export interface StrategyAdapterV1 {
  protocolVersion: 'v1'
  onBar: (ctx: StrategyExecutionContextV1) => StrategyDecisionV1 | Promise<StrategyDecisionV1>
  init?: (ctx: StrategyExecutionContextV1) => unknown
  shutdown?: () => unknown
}
