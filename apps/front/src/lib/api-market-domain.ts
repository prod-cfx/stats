import type { schemas } from '@ai/api-contracts'
import type { MarketType } from '@ai/shared'
import type { ZodTypeAny } from 'zod'
import type {
  TraderFullDataResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from './hyperliquid-api'
import type { MarketDataCatalogItem } from './market-data/catalog-types'

import { cachedRequest, CacheTTL } from './api-cache'
import {
  API_BASE_URL,
  client,
  safeApiCall,
  validateId,
} from './api-client'
import {
  ApiError,
  AuthenticationError,
  apiCall,
  getHttpStatusFromError,
  optionalAuthHeaders,
  shouldFallbackToMock,
  unwrapPaginatedItems,
  unwrapResponse,
} from './api-access'
import {
  fetchTraderFullData as fetchTraderFullDataFromHyperliquid,
  fetchUserFillsFromHyperliquid,
  fetchUserPortfolioFromHyperliquid,
} from './hyperliquid-api'
import { hashStringToSeed, mulberry32 } from './api-mock'
import { FALLBACK_MARKET_DATA_CATALOG } from './market-data/catalog-fallback'

type Infer<T extends ZodTypeAny> = T['_output']

interface BaseResponse<T> {
  data?: T
  message?: string
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

export type PredictionMarketCardResponse = Infer<typeof schemas.PredictionMarketCardDto>
export type ExchangeLongShortRatioApiItem = Infer<typeof schemas.ExchangeLongShortRatioResponseDto>
export type OpenInterestApiItem = Infer<typeof schemas.OpenInterestDto>
export type CryptoStockQuoteLatest = Infer<typeof schemas.CryptoStockQuoteResponseDto>

export type ExchangeLongShortTimeRange = '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '24h'

export interface FetchExchangeLongShortRatioQuery {
  symbol: string
  timeRange: ExchangeLongShortTimeRange
}

interface LongShortRatioQuery {
  tradingPairId: string
  interval: string
  from?: string
  to?: string
  limit?: number
}

interface LongShortRatioPoint {
  tradingPairId: string
  interval: string
  timestamp: string
  longShortRatio: string
  longAccountRatio?: string | null
  shortAccountRatio?: string | null
  longVolume?: string | null
  shortVolume?: string | null
  longShortAccountRatio?: string | null
  source: string
}

export interface LiquidationSummaryItem {
  timeframe: '1h' | '4h' | '12h' | '24h'
  totalUsd: number
  longUsd: number
  shortUsd: number
}

export interface AggregatedLiquidationSummary {
  symbol: string
  items: LiquidationSummaryItem[]
}

export interface ExchangeLiquidationRow {
  exchange: string
  symbol: string
  timeframe: '1h' | '4h' | '12h' | '24h'
  amountUsd: number
  longUsd: number
  shortUsd: number
  longShare?: number
  isTotal?: boolean
}

export interface ExchangeLiquidationResponse {
  symbol: string
  timeframe: '1h' | '4h' | '12h' | '24h'
  rows: ExchangeLiquidationRow[]
}

export interface FetchPredictionMarketsParams {
  category?: string
  onlyActive?: boolean
  limit?: number
  page?: number
  locale?: string
}

export type AggregatedOrderbookQueryType = MarketType

export interface AggregatedOrderbookVenueDetail {
  venueId: string
  size: number
}

export interface AggregatedOrderbookLevel {
  price: number
  sizeTotal: number
  details: AggregatedOrderbookVenueDetail[]
}

export interface AggregatedOrderbookResponse {
  marketKey: string
  base: string
  type: string
  asks: AggregatedOrderbookLevel[]
  bids: AggregatedOrderbookLevel[]
  midPrice: number
  updatedAt: number
  venues: string[]
  mergedQuotes: string[]
}

export interface FetchAggregatedOrderbookParams {
  base: string
  type: AggregatedOrderbookQueryType
  venues?: string
  depth?: number
  tickSize?: number
}

export interface FetchAggregatedOpenInterestQuery {
  symbol: string
  exchange?: string
  limit?: number
}

export interface FetchUserPortfolioQuery {
  skipCache?: boolean
}

export interface FetchUserFillsQuery {
  aggregateByTime?: boolean
  skipCache?: boolean
}

export interface FetchTraderFullDataQuery {
  aggregateByTime?: boolean
  skipCache?: boolean
}

export interface FetchKlineDataParams {
  symbol: string
  interval: string
  from: number
  to: number
  exchange?: string
}

export interface KlineBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TickerData {
  symbol: string
  exchange?: string
  currentPrice: string
  indexPrice?: string
  priceChangePercent24h?: string
  volumeUsd: string
  openInterestUsd?: string
  fundingRate?: string
  nextFundingTime?: string
  high24h?: string
  low24h?: string
}

export interface FetchAggregatedVolumeQuery {
  symbol: string
  instrumentType?: 'SPOT' | 'PERPETUAL'
  page?: number
  limit?: number
}

export interface AggregatedVolumeApiItem {
  id: number
  exchange: string
  symbol: string
  instrumentType?: string
  volumeUsd: string
  dataTimestamp: string
  source: string
  createdAt: string
  updatedAt: string
}

export interface AggregatedVolumeApiResponse extends PaginatedResponse<AggregatedVolumeApiItem> {}

export interface PositionsQueryParams {
  page?: number
  limit?: number
  accountId?: string
  symbol?: string
  positionSide?: 'LONG' | 'SHORT'
}

export interface PositionResponse {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  size: number
  entryPrice: number
  currentPrice?: number
  pnl?: number
  createdAt: string
}

export async function fetchLongShortRatio(
  query: LongShortRatioQuery,
): Promise<LongShortRatioPoint[]> {
  return apiCall(async () => {
    const response = await client.MarketsController_getLongShortRatio({
      headers: optionalAuthHeaders(),
      queries: {
        ...query,
        interval: query.interval as
          | '1h'
          | '4h'
          | '12h'
          | '1m'
          | '5m'
          | '15m'
          | '1d'
          | '3m'
          | '30m'
          | '6h'
          | '8h'
          | '1w',
      },
    })
    return unwrapPaginatedItems(response)
  }, 'FETCH_LONG_SHORT_RATIO')
}

export async function fetchExchangeLongShortRatio(
  query: FetchExchangeLongShortRatioQuery,
): Promise<ExchangeLongShortRatioApiItem[]> {
  try {
    return await apiCall(async () => {
      const response = await client.MarketsController_getExchangeLongShortRatio({
        headers: optionalAuthHeaders(),
        queries: query,
      })
      return unwrapResponse(response) as ExchangeLongShortRatioApiItem[]
    }, 'FETCH_EXCHANGE_LONG_SHORT_RATIO')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const seed = hashStringToSeed(`lsr:${query.symbol}:${query.timeRange}`)
    const rand = mulberry32(seed)
    const exchanges = [
      { name: 'Binance', logoUrl: 'https://static.aicoinstorge.com/exchange/binance.png' },
      { name: 'OKX', logoUrl: 'https://static.aicoinstorge.com/exchange/okx.png' },
      { name: 'Bybit', logoUrl: 'https://static.aicoinstorge.com/exchange/bybit.png' },
      { name: 'Bitget', logoUrl: 'https://static.aicoinstorge.com/exchange/bitget.png' },
      { name: 'Deribit', logoUrl: 'https://static.aicoinstorge.com/exchange/deribit.png' },
    ]

    return exchanges.map((ex, idx) => {
      const longPct = 45 + rand() * 15
      const shortPct = 100 - longPct
      const totalUsd = 2.5e9 + rand() ** 0.25 * 18e9
      const longAmountUsd = totalUsd * (longPct / 100)
      const shortAmountUsd = totalUsd - longAmountUsd
      return {
        rank: idx + 1,
        name: ex.name,
        logoUrl: ex.logoUrl,
        longPercent: longPct,
        shortPercent: shortPct,
        longAmountUsd,
        shortAmountUsd,
      } as any as ExchangeLongShortRatioApiItem
    })
  }
}

export async function fetchAggregatedLiquidationSummary(
  symbol: string,
): Promise<AggregatedLiquidationSummary> {
  try {
    const response = await client.AggregatedLiquidationController_getSummary({
      headers: optionalAuthHeaders(),
      queries: { symbol },
    })
    return unwrapResponse(response) as AggregatedLiquidationSummary
  } catch (error) {
    const status = getHttpStatusFromError(error)
    if (status === 404) return { symbol, items: [] }
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`liq-summary:${symbol}`))
    const items: LiquidationSummaryItem[] = (['1h', '4h', '12h', '24h'] as const).map(tf => {
      const totalUsd = 3e6 + rand() ** 0.35 * 85e6
      const longShare = 0.35 + rand() * 0.3
      const longUsd = totalUsd * longShare
      const shortUsd = totalUsd - longUsd
      return { timeframe: tf, totalUsd, longUsd, shortUsd }
    })
    return { symbol, items }
  }
}

export async function fetchExchangeLiquidation(
  symbol: string,
  timeframe: '1h' | '4h' | '12h' | '24h',
): Promise<ExchangeLiquidationResponse> {
  try {
    const response = await client.AggregatedLiquidationController_getExchanges({
      headers: optionalAuthHeaders(),
      queries: { symbol, timeframe },
    })
    return unwrapResponse(response) as ExchangeLiquidationResponse
  } catch (error) {
    const status = getHttpStatusFromError(error)
    if (status === 404) {
      return {
        symbol,
        timeframe,
        rows: [{ exchange: 'TOTAL', symbol, timeframe, amountUsd: 0, longUsd: 0, shortUsd: 0, longShare: 0, isTotal: true }],
      }
    }
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`liq-ex:${symbol}:${timeframe}`))
    const exchanges = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Deribit']
    const rows: ExchangeLiquidationRow[] = exchanges.map(exchange => {
      const amountUsd = 2e6 + rand() ** 0.35 * 40e6
      const longShare = 0.35 + rand() * 0.3
      const longUsd = amountUsd * longShare
      const shortUsd = amountUsd - longUsd
      return { exchange, symbol, timeframe, amountUsd, longUsd, shortUsd, longShare }
    })
    const totalAmount = rows.reduce((s, r) => s + r.amountUsd, 0)
    const totalLong = rows.reduce((s, r) => s + r.longUsd, 0)
    const totalShort = rows.reduce((s, r) => s + r.shortUsd, 0)
    rows.unshift({
      exchange: 'Total',
      symbol,
      timeframe,
      amountUsd: totalAmount,
      longUsd: totalLong,
      shortUsd: totalShort,
      longShare: totalAmount > 0 ? totalLong / totalAmount : undefined,
      isTotal: true,
    })
    return { symbol, timeframe, rows }
  }
}

export async function fetchCryptoStockQuotesLatest(params?: {
  symbols?: string[]
  source?: string
}): Promise<CryptoStockQuoteLatest[]> {
  try {
    return await apiCall(async () => {
      const searchParams = new URLSearchParams()
      if (params?.symbols?.length) {
        for (const symbol of params.symbols) {
          searchParams.append('symbols', symbol)
        }
      }
      if (params?.source) searchParams.set('source', params.source)
      const query = searchParams.toString()

      const response = await safeApiCall(
        () =>
          client.CryptoStockQuotesController_getLatest({
            headers: optionalAuthHeaders(),
            queries: {
              ...(params?.symbols && params.symbols.length > 0 ? { symbols: params.symbols } : {}),
              ...(params?.source ? { source: params.source } : {}),
            },
          }),
        {
          url: query.length > 0 ? `${API_BASE_URL}/crypto-stock-quotes/latest?${query}` : `${API_BASE_URL}/crypto-stock-quotes/latest`,
          options: {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
          },
          validateResponse: data => ({
            data: unwrapResponse<CryptoStockQuoteLatest[]>(
              data as unknown as CryptoStockQuoteLatest[] | BaseResponse<CryptoStockQuoteLatest[]>,
            ),
          }),
        },
      )

      return unwrapResponse<CryptoStockQuoteLatest[]>(response)
    }, 'FETCH_CRYPTO_STOCK_QUOTES_LATEST')
  } catch (error) {
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      throw new AuthenticationError('TOKEN_EXPIRED')
    }
    if (shouldFallbackToMock(error)) {
      const rand = mulberry32(hashStringToSeed('crypto-stocks:latest'))
      const rows = [
        { symbol: 'PYPL', assetSymbol: 'PYUSD', exchange: 'NASDAQ', name: 'PayPal Holdings, Inc.' },
        { symbol: 'MSTR', assetSymbol: 'BTC', exchange: 'NASDAQ', name: 'MicroStrategy Incorporated' },
        { symbol: 'CRCL', assetSymbol: 'USDC', exchange: 'NYSE', name: 'Circle Internet Group' },
        { symbol: 'BMNR', assetSymbol: 'ETH', exchange: 'NYSE', name: 'BitMine Immersion' },
        { symbol: 'BTDR', assetSymbol: 'BCH', exchange: 'NASDAQ', name: 'Bitdeer Technologies Group' },
      ]
      return rows.map(r => {
        const basePrice = 10 + rand() * 300
        const pct = (rand() - 0.5) * 2
        const marketCap = (1e9 + rand() ** 0.25 * 80e9).toFixed(2)
        return {
          symbol: r.symbol,
          name: r.name,
          exchange: r.exchange,
          price: basePrice.toFixed(2),
          priceChangePercent: (pct * 100).toFixed(2),
          marketCap,
          assetSymbol: r.assetSymbol,
          assetLogoUrl: '/images/icon-default.svg',
          companyLogoUrl: '/images/icon-default.svg',
          mNav: (rand() * 1.2).toFixed(2),
          holdingsValue: '-',
          holdingsAmount: '-',
        } as any as CryptoStockQuoteLatest
      })
    }
    throw error
  }
}

export async function fetchOpenPositions(
  params: PositionsQueryParams = {},
): Promise<PaginatedResponse<PositionResponse>> {
  return {
    total: 0,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    items: [],
  }
}

export async function fetchHistoricalPositions(
  params: PositionsQueryParams = {},
): Promise<PaginatedResponse<PositionResponse>> {
  return {
    total: 0,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    items: [],
  }
}

export async function fetchPredictionMarkets(
  params: FetchPredictionMarketsParams = {},
): Promise<PredictionMarketCardResponse[]> {
  try {
    return await apiCall(async () => {
      const page = params.page ?? 1
      const limit = params.limit ?? 48

      const response = await client.PolymarketController_listMarkets({
        headers: optionalAuthHeaders(),
        queries: {
          ...(params.category && { category: params.category }),
          ...(params.onlyActive !== undefined && { onlyActive: params.onlyActive }),
          ...(params.locale && { locale: params.locale }),
          page,
          limit,
        },
      })

      return unwrapResponse<PredictionMarketCardResponse[]>(response as any)
    }, 'FETCH_PREDICTION_MARKETS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`pm:${params.category ?? 'all'}:${params.onlyActive ? '1' : '0'}`))
    const count = params.limit ?? 48
    return Array.from({ length: Math.min(count, 24) }).map((_, idx) => {
      const probA = 0.1 + rand() * 0.8
      const probB = 1 - probA
      return {
        id: `mock-${idx}`,
        title: idx % 2 === 0 ? 'What price will Bitcoin hit in 2026?' : 'Will the Fed cut rates this year?',
        status: 'LIVE',
        probability: (0.2 + rand() * 0.7).toFixed(2),
        volume24h: Math.floor(1e6 + rand() ** 0.25 * 45e6),
        options: [
          { label: 'Yes', probability: probA.toFixed(2) },
          { label: 'No', probability: probB.toFixed(2) },
        ],
        rules: {
          paragraphs: ['This is mock data shown when the backend is unavailable.', 'The market resolves based on publicly available sources.'],
          createdAt: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
        },
      } as any as PredictionMarketCardResponse
    })
  }
}

export async function fetchAggregatedOrderbook(
  params: FetchAggregatedOrderbookParams,
): Promise<AggregatedOrderbookResponse> {
  try {
    return await apiCall(async () => {
      const response = await client.AggregatedOrderbookController_getAggregatedOrderbook({
        queries: {
          base: params.base,
          type: params.type,
          ...(params.venues && { venues: params.venues }),
          ...(params.depth && { depth: params.depth }),
          ...(params.tickSize && { tickSize: params.tickSize }),
        },
      })
      return unwrapResponse<AggregatedOrderbookResponse>(response as any)
    }, 'FETCH_AGGREGATED_ORDERBOOK')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const depth = params.depth ?? 100
    const seed = hashStringToSeed(`ob:${params.base}:${params.type}:${params.venues ?? ''}:${params.tickSize ?? ''}`)
    const rand = mulberry32(seed)
    const mid = params.base === 'BTC' ? 65_000 + rand() * 8_000 : 2_500 + rand() * 300
    const tick = params.tickSize ?? (params.base === 'BTC' ? 1 : 0.5)
    const venues = (params.venues ? params.venues.split(',') : ['binance', 'bybit', 'okx']).slice(0, 5)

    const buildSide = (dir: 'ask' | 'bid'): AggregatedOrderbookLevel[] =>
      Array.from({ length: Math.min(depth, 80) }).map((_, i) => {
        const price = dir === 'ask' ? mid + tick * (i + 1) : mid - tick * (i + 1)
        const sizeTotal = 0.15 + rand() ** 0.4 * 18
        const details = venues.map(v => ({ venueId: v, size: sizeTotal * (0.15 + rand() * 0.5) }))
        return { price: Number(price.toFixed(2)), sizeTotal: Number(sizeTotal.toFixed(4)), details }
      })

    return {
      marketKey: `${params.base}-${params.type}`,
      base: params.base,
      type: params.type,
      asks: buildSide('ask'),
      bids: buildSide('bid'),
      midPrice: Number(mid.toFixed(2)),
      updatedAt: Date.now(),
      venues,
      mergedQuotes: [],
    }
  }
}

export async function fetchAggregatedOpenInterest(
  query: FetchAggregatedOpenInterestQuery,
): Promise<OpenInterestApiItem[]> {
  try {
    return await apiCall(async () => {
      const response = await client.OpenInterestController_query({
        headers: optionalAuthHeaders(),
        queries: {
          symbol: query.symbol,
          ...(query.exchange && { exchange: query.exchange }),
          limit: query.limit ?? 100,
        },
      })

      const result = unwrapResponse(response) as { items?: OpenInterestApiItem[] }
      return result.items ?? []
    }, 'FETCH_AGGREGATED_OPEN_INTEREST')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`oi:${query.symbol}:${query.exchange ?? 'all'}`))
    const count = query.limit ?? 100
    const now = Date.now()
    return Array.from({ length: count }).map(
      (_, i) => ({
        symbol: query.symbol,
        exchange: query.exchange || 'Binance',
        openInterest: 1e8 + rand() * 5e8,
        timestamp: new Date(now - i * 3600_000).toISOString(),
      }) as unknown as OpenInterestApiItem,
    )
  }
}

export async function fetchKlineData(params: FetchKlineDataParams): Promise<KlineBar[]> {
  try {
    return await apiCall(async () => {
      const response = await client.KlineController_getKlineBars({
        queries: {
          ...params,
          interval: params.interval as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
        },
      })
      return unwrapResponse(response) as KlineBar[]
    }, 'FETCH_KLINE_DATA')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return []
  }
}

export async function fetchTicker(symbol: string, exchange?: string): Promise<TickerData | null> {
  try {
    return await apiCall(async () => {
      const response = await client.MarketsController_getTicker({
        queries: {
          symbol,
          ...(exchange ? { exchange } : {}),
        },
      })
      return unwrapResponse(response) as TickerData | null
    }, 'FETCH_TICKER')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return null
  }
}

export async function fetchAggregatedVolume(
  query: FetchAggregatedVolumeQuery,
): Promise<AggregatedVolumeApiResponse> {
  try {
    return await apiCall(async () => {
      const response = await client.MarketsController_getAggregatedVolumes({
        headers: optionalAuthHeaders(),
        queries: {
          symbol: query.symbol,
          ...(query.instrumentType && { instrumentType: query.instrumentType }),
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        },
      })

      return unwrapResponse(response) as AggregatedVolumeApiResponse
    }, 'FETCH_AGGREGATED_VOLUME')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return {
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      items: [],
    }
  }
}

export async function fetchMarketDataCatalogItems(): Promise<MarketDataCatalogItem[]> {
  if (process.env.NEXT_PUBLIC_MOCK_API === '1') {
    return FALLBACK_MARKET_DATA_CATALOG
  }

  return cachedRequest(
    'meta:market-data-catalog',
    async () => FALLBACK_MARKET_DATA_CATALOG,
    CacheTTL.VERY_LONG,
  )
}
