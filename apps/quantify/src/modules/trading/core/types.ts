import type { ExchangeId as SharedExchangeId } from '@ai/shared'
import type { ExchangeError } from './errors'

export type ExchangeId = SharedExchangeId
export type MarketType = 'spot' | 'perp'

export type OrderSide = 'buy' | 'sell'

export type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit'

export type TimeInForce = 'GTC' | 'IOC' | 'FOK'
export type PositionIntentSide = 'LONG' | 'SHORT'
export type TradeMode = 'cash' | 'cross' | 'isolated'

export type PositionSide = 'long' | 'short' | 'net'

export interface OrderQueryInput {
  symbol?: string
  clientOrderId?: string
  exchangeOrderId?: string
}

export interface UnifiedSymbol {
  exchangeId: ExchangeId
  marketType: MarketType
  base: string
  quote: string
  /**
   * 统一写法，例如：
   * - 现货: BTC/USDT
   * - 永续: BTC/USDT:PERP
   */
  symbol: string
  /**
   * 交易所原始 symbol，例如：
   * - Binance 现货: BTCUSDT
   * - OKX 现货: BTC-USDT
   * - OKX 永续: BTC-USDT-SWAP
   */
  rawSymbol: string
}

export interface UnifiedOrder {
  id: string
  clientOrderId?: string
  symbol: string
  marketType: MarketType
  side: OrderSide
  type: OrderType
  price?: number
  amount: number
  filled: number
  status: 'open' | 'closed' | 'canceled' | 'rejected' | 'partially_filled'
  createdAt: number
  updatedAt?: number
  /**
   * 保留交易所原始返回，方便调试和特殊字段访问
   */
  raw: unknown
}

export interface UnifiedPosition {
  symbol: string
  marketType: MarketType
  side: 'long' | 'short' | 'flat'
  size: number
  entryPrice: number
  leverage?: number
  unrealizedPnl: number
  liquidationPrice?: number
  raw: unknown
}

export interface UnifiedBalance {
  asset: string
  free: number
  locked: number
  total: number
}

export interface UnifiedTicker {
  symbol: string
  last: number
  bid: number
  ask: number
  high: number
  low: number
  volume: number
  raw: unknown
}

export interface CreateOrderInput {
  symbol: string
  marketType: MarketType
  side: OrderSide
  type: OrderType
  amount: number
  price?: number
  timeInForce?: TimeInForce
  tdMode?: TradeMode
  positionSide?: PositionIntentSide
  reduceOnly?: boolean
  posSide?: PositionSide
  clientOrderId?: string
  /**
   * 预留给特定交易所的附加参数。
   */
  extra?: Record<string, unknown>
}

/**
 * 为了方便 service 层使用 Result 模式，这里提供一个简单的 Result 类型。
 * 如果调用方倾向于使用 try/catch，可以忽略该类型。
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ExchangeError }
