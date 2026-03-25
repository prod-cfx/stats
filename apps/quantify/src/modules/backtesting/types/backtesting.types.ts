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
  reasonClose?: string
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
}

export interface BacktestRunInput {
  symbols: string[]
  baseTimeframe: Timeframe
  stateTimeframes: Timeframe[]
  allowPartial?: boolean
  initialCash: number
  leverage: number
  execution: ExecutionConfig
  strategy: { id: string; params: Record<string, unknown>; fn: StrategyFn }
  dataRange: { fromTs: number; toTs: number }
  bars: Bar[]
}
