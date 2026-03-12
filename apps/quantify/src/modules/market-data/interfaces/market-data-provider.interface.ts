import type {
  MarketBarPayload,
  MarketInstrumentType,
  MarketQuotePayload,
  MarketTimeframe,
} from '@ai/shared'

export interface ProviderSymbolFilter {
  filterType: string
  tickSize?: string
  stepSize?: string
  minPrice?: string
  maxPrice?: string
  minQty?: string
  maxQty?: string
}

export interface ProviderSymbol {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
  type?: string
  exchange?: string
  isMarginTradingAllowed?: boolean
  filters?: ProviderSymbolFilter[]
  instrumentType?: MarketInstrumentType
}

export interface HistoricalBarQuery {
  symbol: string
  timeframe: MarketTimeframe
  start?: Date
  end?: Date
  limit?: number
}

export interface SubscribeParams {
  symbols: string[]
  timeframes: MarketTimeframe[]
  onTick?: (tick: MarketQuotePayload) => Promise<void> | void
  onKline?: (bar: MarketBarPayload) => Promise<void> | void
}

export interface MarketDataProvider {
  readonly name: string
  fetchSymbols: (symbols?: string[]) => Promise<ProviderSymbol[]>
  fetchHistoricalBars: (query: HistoricalBarQuery) => Promise<MarketBarPayload[]>
  subscribe: (params: SubscribeParams) => Promise<() => Promise<void> | void>
  disconnect: () => Promise<void>
}
