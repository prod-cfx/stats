import type { ExchangeError } from './errors'

export type ExchangeId = 'binance' | 'okx' | 'hyperliquid'

export type MarketType = 'spot' | 'perp'

export type OrderSide = 'buy' | 'sell'

export type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit'

export type TimeInForce = 'GTC' | 'IOC' | 'FOK'

export interface UnifiedSymbol {
  exchangeId: ExchangeId
  marketType: MarketType
  base: string
  quote: string
  /**
   * 缁熶竴鍐欐硶锛屼緥濡?
   * - 鐜拌揣: BTC/USDT
   * - 姘哥画: BTC/USDT:PERP
   */
  symbol: string
  /**
   * 浜ゆ槗鎵€鍘熷 symbol锛屼緥濡?
   * - Binance 鐜拌揣: BTCUSDT
   * - OKX 鐜拌揣: BTC-USDT
   * - OKX 姘哥画: BTC-USDT-SWAP
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
   * 淇濈暀浜ゆ槗鎵€鍘熷杩斿洖锛屾柟渚胯皟璇曞拰鐗规畩瀛楁璁块棶
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
  reduceOnly?: boolean
  clientOrderId?: string
  /**
   * 棰勭暀缁欑壒瀹氫氦鏄撴墍鐨勯檮鍔犲弬鏁?
   */
  extra?: Record<string, unknown>
}

/**
 * 涓轰簡鏂逛究鍦?service 灞備娇鐢?Result 妯″紡锛岃繖閲屾彁渚涗竴涓畝鍗曠殑 Result 绫诲瀷銆?
 * 濡傛灉璋冪敤鏂瑰€惧悜浜庝娇鐢?try/catch锛屽彲浠ュ拷鐣ヨ绫诲瀷銆?
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ExchangeError }
