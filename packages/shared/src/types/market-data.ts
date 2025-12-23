export const MARKET_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

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

