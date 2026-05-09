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
