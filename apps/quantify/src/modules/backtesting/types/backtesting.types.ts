import type { MarketTimeframe, StrategyDecisionV1 } from '@ai/shared'
import type { SemanticRuntimeState } from '@/modules/strategy-runtime/semantic-runtime-state.util'

export type Timeframe = MarketTimeframe

export interface Bar {
  symbol: string
  timeframe: Timeframe
  openTime: number
  closeTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface RuntimeEvent {
  id: string
  ts: number
  payload: Record<string, unknown>
}

export interface StateSnapshot {
  symbol: string
  timeframe: Timeframe
  ts: number
  values: Record<string, number | boolean | string>
}

export interface PositionView {
  symbol: string
  qty: number
  avgEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
  barsHeld?: number
  entryTimeframe?: Timeframe
  highestPriceSinceEntry?: number
  lowestPriceSinceEntry?: number
}

export interface PortfolioView {
  cash: number
  equity: number
  usedMargin: number
  realizedPnl: number
}

export interface StrategyContext {
  ts: number
  symbol: string
  baseTimeframeBar: Bar
  htfState: Record<string, StateSnapshot>
  position: PositionView
  portfolio: PortfolioView
  params: Record<string, unknown>
  semanticRuntimeState?: SemanticRuntimeState
}

export type SignalIntent =
  | { type: 'TARGET_POSITION'; targetQty: number; reason?: string }
  | { type: 'OPEN_LONG'; qty: number; reason?: string }
  | { type: 'OPEN_SHORT'; qty: number; reason?: string }
  | { type: 'CLOSE'; qty?: number; reason?: string }
  | { type: 'NOOP'; reason?: string }
  | StrategyDecisionV1
  | {
    direction: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    signalType: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'
    confidence: number
    entryPrice: number
    stopLoss: number
    takeProfit: number
    reasoning: string
    positionSizeQuote?: number
    positionSizeRatio?: number
  }

export type StrategyFn = (ctx: StrategyContext) => SignalIntent | Promise<SignalIntent>

export type BacktestReasonSource = 'strategy' | 'risk' | 'system'

export interface BacktestExecutionPolicy {
  signalTiming?: 'BAR_CLOSE'
  fillTiming?: 'NEXT_BAR_OPEN' | 'BAR_CLOSE'
  noNextBarHandling?: 'KEEP_PENDING' | 'DROP_SIGNAL'
}

export interface BacktestOutsideBandIndicatorRef {
  kind: 'bollingerBands'
  period: number
  stdDev: number
}

export interface BacktestOutsideBandRiskRule {
  mode?: 'STATIC_BOUNDS' | 'BOLLINGER_BANDS'
  lowerBound?: number
  upperBound?: number
  indicator?: BacktestOutsideBandIndicatorRef
  consecutiveBars?: number
  action: 'REDUCE' | 'CLOSE'
  reduceRatio?: number
}

export interface BacktestRiskRules {
  maxFloatingLossPct?: number
  outsideBand?: BacktestOutsideBandRiskRule
}

export interface BacktestScriptMetadata {
  source?: string
  [key: string]: unknown
}

export interface ExecutionConfig {
  slippageBps: number
  feeBps: number
  priceSource: 'open' | 'close' | 'mid'
}

export interface Fill {
  symbol: string
  ts: number
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  notional: number
  fee: number
  reason?: string
  entryTimeframe?: Timeframe
}

export interface Position {
  symbol: string
  qty: number
  avgEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
  entryTimeframe?: Timeframe
}

export interface PortfolioState {
  cash: number
  equity: number
  usedMargin: number
  realizedPnl: number
  positions: Record<string, Position>
}

export interface TradeRecord {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  entryTimeframe?: Timeframe
  exitTs: number
  exitPrice: number
  qty: number
  fee: number
  pnl: number
  returnPct: number
  reasonOpen?: string
  reasonOpenSource?: BacktestReasonSource
  reasonClose?: string
  reasonCloseSource?: BacktestReasonSource
  exitReason?: string
  exitSource?: BacktestReasonSource
}

export interface TradeMarker {
  symbol: string
  ts: number
  price: number
  kind: 'entry_long' | 'entry_short' | 'exit_long' | 'exit_short'
  tradeId: string
}

export interface BacktestReport {
  summary: {
    netProfit: number
    netProfitPct: number
    maxDrawdownPct: number
    winRate: number
    profitFactor: number | null
    totalTrades: number
    totalOpenTrades?: number
    openPnl?: number
    /**
     * Issue #1699 P2a：trades=0 时按 diagnostics 派发的根因错误码（ErrorCode 字符串）。
     * 前端拿到此值后可把笼统「未产生有效成交」拆为「rules 没编译 / 信号未触发 / 触发未成交」三类提示。
     */
    diagnosticReason?: BacktestDiagnosticReasonCode
  }
  diagnostics: BacktestDiagnostics
  equityCurve: Array<{ ts: number; equity: number }>
  trades: TradeRecord[]
  markers: TradeMarker[]
  bySymbol: Array<{ symbol: string; pnl: number; trades: number; winRate: number }>
  openPositions?: Array<{ symbol: string; qty: number; avgEntryPrice: number; unrealizedPnl: number; entryTimeframe?: Timeframe }>
  pendingSignals?: Array<{ symbol: string; ts: number; deltaQty: number; reason?: string; reasonSource: BacktestReasonSource }>
}

export type BacktestDiagnosticReasonCode =
  | 'BACKTEST_NO_RULES_COMPILED'
  | 'BACKTEST_DATA_REQUIREMENT_UNAVAILABLE'
  | 'BACKTEST_EVENT_STREAM_UNAVAILABLE'
  | 'BACKTEST_NO_SIGNAL_FIRED_IN_RANGE'
  | 'BACKTEST_SIGNAL_FIRED_BUT_NO_FILL'

/**
 * 回测主流诊断：让「未产生有效成交」可定位到 rules / 信号 / 撮合三层。
 * compiledRulesCount=0 → NO_RULES_COMPILED
 * signalTriggerCount=0 → NO_SIGNAL_FIRED_IN_RANGE
 * signalTriggerCount>0 但 fillCount=0 → SIGNAL_FIRED_BUT_NO_FILL
 */
export interface BacktestDiagnostics {
  compiledRulesCount: number
  signalTriggerCount: number
  fillCount: number
  dataRequirementMissingCount: number
  eventStreamMissingCount: number
}

export type BacktestRequestedRangePreset = '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'

export interface BacktestRequestedRangeInput {
  preset: BacktestRequestedRangePreset
  startAt?: string
  endAt?: string
}

export interface BacktestRunInput {
  symbols: string[]
  baseTimeframe: Timeframe
  stateTimeframes: Timeframe[]
  conversationId?: string
  sessionId?: string
  allowPartial?: boolean
  initialCash: number
  leverage?: number | null
  execution: ExecutionConfig
  strategy: {
    id: string
    strategyInstanceId?: string
    strategyTemplateId?: string
    params: Record<string, unknown>
    bindingSource?: 'PUBLISHED_SNAPSHOT_STRICT'
    executionPolicy?: BacktestExecutionPolicy
    riskRules?: BacktestRiskRules
    scriptMetadata?: BacktestScriptMetadata
    snapshotId?: string
    snapshotHash?: string
    scriptHash?: string
    specHash?: string
    irHash?: string
    astDigest?: string
    structuralDigest?: string
    irSnapshot?: Record<string, unknown>
    astSnapshot?: Record<string, unknown>
    executionEnvelope?: Record<string, unknown>
    dataRequirements?: Record<string, unknown>
    specSnapshot?: Record<string, unknown>
    fn: StrategyFn
  }
  requestedRangeInput?: BacktestRequestedRangeInput
  dataRange: { fromTs: number; toTs: number }
  eventStreams?: Record<string, RuntimeEvent[]>
  bars: Bar[]
}
