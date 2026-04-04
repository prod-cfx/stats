import type { StrategyDecisionV1 } from '@ai/shared'

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d'

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
}

export interface Position {
  symbol: string
  qty: number
  avgEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
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
    profitFactor: number
    totalTrades: number
  }
  equityCurve: Array<{ ts: number; equity: number }>
  trades: TradeRecord[]
  markers: TradeMarker[]
  bySymbol: Array<{ symbol: string; pnl: number; trades: number; winRate: number }>
  openPositions?: Array<{ symbol: string; qty: number; avgEntryPrice: number; unrealizedPnl: number }>
  pendingSignals?: Array<{ symbol: string; ts: number; deltaQty: number; reason?: string; reasonSource: BacktestReasonSource }>
}

export interface BacktestRunInput {
  symbols: string[]
  baseTimeframe: Timeframe
  stateTimeframes: Timeframe[]
  allowPartial?: boolean
  initialCash: number
  leverage: number
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
    dataRequirements?: Record<string, unknown>
    specSnapshot?: Record<string, unknown>
    fn: StrategyFn
  }
  dataRange: { fromTs: number; toTs: number }
  bars: Bar[]
}
