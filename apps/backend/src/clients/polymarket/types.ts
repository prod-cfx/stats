export interface GammaMarketsResponse {
  markets: PolymarketGammaMarket[]
  nextCursor?: string | null
  next_cursor?: string | null
}

export interface PolymarketGammaMarket {
  id: string
  slug: string
  title: string
  question?: string
  description?: string
  outcomeType?: string
  status?: string
  category?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
  start_date?: string
  end_date?: string
  close_date?: string
  resolution_source?: string
  resolution_time?: string
  liquidity?: string
  volume24hr?: string
  open_interest?: string
  event_id?: string
  event?: PolymarketGammaEvent
  events?: PolymarketGammaEvent[] // API 实际返回的是 events 数组
  outcomes?: PolymarketGammaOutcome[]
  [key: string]: unknown
}

export interface PolymarketGammaOutcome {
  id: string
  token_id: string
  name?: string
  side?: string
  price?: string
  probability?: string
  liquidity?: string
  pool_balance?: string
  last_trade_price?: string
  last_trade_time?: string
  [key: string]: unknown
}

export interface PolymarketGammaEvent {
  id: string
  slug?: string
  title?: string
  description?: string
  category?: string
  subcategories?: string[]
  start_date?: string
  end_date?: string
  resolution_source?: string
  resolution_time?: string
  tags?: string[]
  status?: string
  [key: string]: unknown
}

export interface PolymarketBookLevel {
  price: string
  size: string
}

export interface PolymarketRestBook {
  market: string
  token_id: string
  timestamp: number
  hash?: string
  seq?: number
  min_order_size?: string
  negative_risk?: boolean
  bids: PolymarketBookLevel[]
  asks: PolymarketBookLevel[]
  [key: string]: unknown
}

export interface PolymarketMarketChannelMessage {
  event_type: string
  asset_id: string
  market: string
  bids?: PolymarketBookLevel[] | [string, string][]
  asks?: PolymarketBookLevel[] | [string, string][]
  timestamp?: number
  hash?: string
  seq?: number
  price_changes?: Record<string, unknown>
  [key: string]: unknown
}
