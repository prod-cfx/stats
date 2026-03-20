// 市场数据统一支持的时间粒度
// 注意：如需扩展，请同时更新：
// - apps/backend/prisma/schema/market_data.prisma 中的 MarketTimeframe 枚举
// - apps/backend/src/common/utils/prisma-enum-mappers.ts 中的 mapTimeframe/reverseMapTimeframe
export const MARKET_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '1w',
] as const

export type MarketTimeframe = (typeof MARKET_TIMEFRAMES)[number]

export const MARKET_SYMBOL_TYPES = ['CRYPTO', 'STOCK', 'FOREX'] as const
export type MarketSymbolType = (typeof MARKET_SYMBOL_TYPES)[number]

export const MARKET_SYMBOL_STATUSES = ['ACTIVE', 'DISABLED'] as const
export type MarketSymbolStatus = (typeof MARKET_SYMBOL_STATUSES)[number]

export const MARKET_INSTRUMENT_TYPES = ['SPOT', 'PERPETUAL', 'FUTURE'] as const
export type MarketInstrumentType = (typeof MARKET_INSTRUMENT_TYPES)[number]

export interface MarketBarPayload {
  symbol: string
  timeframe: MarketTimeframe
  open: string
  high: string
  low: string
  close: string
  volume?: string
  quoteVolume?: string
  trades?: number
  source?: string
  timestamp: number
  isFinal?: boolean
}

export interface MarketQuotePayload {
  symbol: string
  lastPrice: string
  priceChange?: string
  priceChangePercent?: string
  openPrice?: string
  highPrice?: string
  lowPrice?: string
  volume?: string
  quoteVolume?: string
  bidPrice?: string
  bidQty?: string
  askPrice?: string
  askQty?: string
  eventTime: number
  source?: string
}

export const DEFAULT_MARKET_SYMBOLS = ['BTCUSDT', 'ETHUSDT'] as const

