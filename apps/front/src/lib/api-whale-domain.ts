import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'
import type {
  TraderFullDataResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from './hyperliquid-api'

import { cachedRequest, CacheTTL } from './api-cache'
import {
  API_BASE_URL,
  client,
  safeApiCall,
} from './api-client'
import {
  apiCall,
  optionalAuthHeaders,
  shouldFallbackToAccountAiQuantMock,
  shouldFallbackToMock,
  unwrapPaginatedItems,
  unwrapResponse,
} from './api-access'
import {
  fetchTraderFullData as fetchTraderFullDataFromHyperliquid,
  fetchTraderOpenOrdersFromHyperliquid,
  fetchUserFillsFromHyperliquid,
  fetchUserPortfolioFromHyperliquid,
} from './hyperliquid-api'
import { hashStringToSeed, mulberry32 } from './api-mock'

type Infer<T extends ZodTypeAny> = T['_output']

interface BaseResponse<T> {
  data?: T
  message?: string
}

interface PaginatedItemsResponse<T> {
  items?: T[]
}

export type WhaleHoldingApiItem = Infer<typeof schemas.WhaleHoldingDto>
export type WhaleAddressPerformanceResponse = Infer<typeof schemas.WhaleAddressPerformanceResponseDto>
export type TraderDiscoverTagsResponse = Infer<typeof schemas.TraderDiscoverTagsResponseDto>
export type WhaleDiscoverResponse = Infer<typeof schemas.WhaleDiscoverResponseDto>
export type WhaleDiscoverTraderAiTag = Infer<typeof schemas.WhaleDiscoverTraderAiTagDto>
export type TraderSnapshotResponse = Infer<typeof schemas.TraderSnapshotResponseDto>
export type TraderPositionsResponse = Infer<typeof schemas.TraderPositionsResponseDto>
export type TraderOpenOrdersResponse = Infer<typeof schemas.TraderOpenOrdersResponseDto>
export type RealtimeWhaleAlertItem = Infer<typeof schemas.RealtimeWhaleAlertDto>
export type WhaleTradeDto = Infer<typeof schemas.WhaleTradeDto>

export interface FetchWhaleHoldingsQuery {
  symbol?: string
  minPositionValueUsd?: number
  limit?: number
}

export interface FetchWhaleAddressPerformanceQuery {
  timeRangeDays?: number
  symbol?: string
  limit?: number
}

export interface FetchTraderDiscoverTagsQuery {
  skipCache?: boolean
}

export interface FetchTraderSnapshotQuery {
  skipCache?: boolean
}

export interface FetchTraderPositionsQuery {
  type?: 'perp' | 'spot' | 'all'
  skipCache?: boolean
}

export interface FetchTraderOpenOrdersQuery {
  coin?: string
  skipCache?: boolean
}

export interface FetchRealtimeWhaleAlertsParams {
  symbol?: string
  minPositionValueUsd?: number
  limit?: number
  since?: string
}

export interface FetchWhaleTradesRealtimeParams {
  symbol?: string
  minTradeValueUsd?: number
  limit?: number
  since?: string
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

function getTraderDiscoverTagsMethod(
  apiClient: typeof client,
): typeof client.WhaleTrackingController_getTraderDiscoverTags | undefined {
  const candidate = apiClient as unknown as Partial<{
    WhaleTrackingController_getTraderDiscoverTags: typeof client.WhaleTrackingController_getTraderDiscoverTags
  }>
  return typeof candidate.WhaleTrackingController_getTraderDiscoverTags === 'function'
    ? candidate.WhaleTrackingController_getTraderDiscoverTags
    : undefined
}

export async function fetchWhaleHoldings(
  query: FetchWhaleHoldingsQuery = {},
): Promise<WhaleHoldingApiItem[]> {
  try {
    return await apiCall(async () => {
      const response = await client.WhaleHoldingsController_getWhaleHoldings({
        headers: optionalAuthHeaders(),
        queries: query,
      })

      return unwrapPaginatedItems(response)
    }, 'FETCH_WHALE_HOLDINGS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const symbol = query.symbol || 'BTC'
    const rand = mulberry32(hashStringToSeed(`whale-holdings:${symbol}`))
    const sides = ['LONG', 'SHORT'] as const
    return Array.from({ length: query.limit ?? 50 }).map((_, idx) => {
      const side = sides[Math.floor(rand() * sides.length)]
      const positionValueUsd = 800_000 + rand() * 12_000_000
      const entryPrice =
        symbol === 'BTC'
          ? 40_000 + rand() * 40_000
          : symbol === 'ETH'
            ? 1_500 + rand() * 2_500
            : 50 + rand() * 200
      const positionSize = positionValueUsd / entryPrice
      const liquidationPrice =
        entryPrice * (side === 'LONG' ? 0.75 + rand() * 0.15 : 1.15 + rand() * 0.25)
      const pnl = (rand() * 2 - 1) * positionValueUsd * 0.1
      const roe = pnl / positionValueUsd
      const snapshotTime = new Date(Date.now() - Math.floor(rand() * 24 * 60) * 60_000).toISOString()
      return {
        userAddress: `0x${Math.floor(rand() * 1e16).toString(16).padStart(16, '0')}${idx.toString(16).padStart(4, '0')}`,
        symbol,
        side,
        positionValueUsd,
        positionSize,
        entryPrice,
        liquidationPrice,
        pnl,
        roe,
        snapshotTime,
      } as any as WhaleHoldingApiItem
    })
  }
}

export async function fetchTraderDiscoverTags(
  address: string,
  query: FetchTraderDiscoverTagsQuery = {},
): Promise<TraderDiscoverTagsResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (typeof query.skipCache === 'boolean') {
      params.set('skipCache', String(query.skipCache))
    }

    const search = params.toString()
    const fallbackUrl =
      search.length > 0
        ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/discover-tags?${search}`
        : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/discover-tags`
    const fallbackConfig = {
      url: fallbackUrl,
      options: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...optionalAuthHeaders(),
        },
      },
      validateResponse: (data: unknown) =>
        unwrapResponse<TraderDiscoverTagsResponse>(
          data as TraderDiscoverTagsResponse | BaseResponse<TraderDiscoverTagsResponse>,
        ),
    }

    const method = getTraderDiscoverTagsMethod(client)

    if (method) {
      return safeApiCall<TraderDiscoverTagsResponse>(
        () =>
          method({
            headers: optionalAuthHeaders(),
            params: { address },
          }),
        fallbackConfig,
      )
    }

    return safeApiCall(
      () => Promise.reject(new Error('WhaleTrackingController_getTraderDiscoverTags is not available')),
      fallbackConfig,
    )
  }, 'FETCH_TRADER_DISCOVER_TAGS')
}

export async function fetchWhaleAddressPerformance(
  address: string,
  query: FetchWhaleAddressPerformanceQuery = {},
): Promise<WhaleAddressPerformanceResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (typeof query.timeRangeDays === 'number') params.set('timeRangeDays', String(query.timeRangeDays))
    if (query.symbol) params.set('symbol', query.symbol)
    if (typeof query.limit === 'number') params.set('limit', String(query.limit))

    const search = params.toString()
    const fallbackUrl =
      search.length > 0
        ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/performance?${search}`
        : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/performance`

    return safeApiCall(
      () =>
        client.WhaleTrackingController_getTraderPerformance({
          headers: optionalAuthHeaders(),
          params: { address },
          queries: query,
        }),
      {
        url: fallbackUrl,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...optionalAuthHeaders(),
          },
        },
        validateResponse: data =>
          unwrapResponse<WhaleAddressPerformanceResponse>(
            data as WhaleAddressPerformanceResponse | BaseResponse<WhaleAddressPerformanceResponse>,
          ),
      },
    )
  }, 'FETCH_WHALE_ADDRESS_PERFORMANCE')
}

export async function fetchWhaleTrackingDiscover(): Promise<WhaleDiscoverResponse> {
  try {
    return await apiCall(async () => {
      const response = await client.WhaleTrackingController_getDiscover({
        headers: optionalAuthHeaders(),
      })

      return unwrapResponse(response) as WhaleDiscoverResponse
    }, 'FETCH_WHALE_TRACKING_DISCOVER')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    const rand = mulberry32(hashStringToSeed('whale-discover'))
    const palette = ['#60a5fa', '#c084fc', '#34d399', '#fbbf24', '#fb7185']
    const tagKeys = ['bullWarGod', 'swingKing', 'smartTrader', 'treasuryKeeper', 'twitterKol'] as const

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16).toString(16).padStart(16, '0')
      return `0x${a}${idx.toString(16).padStart(4, '0')}`
    }

    const makeTrader = (variant: 'recommended' | 'detail', idx: number) => {
      const totalValueUsd = Math.floor(500_000 + rand() ** 0.35 * 50_000_000)
      const pnlUsd = Math.floor((rand() - 0.45) * 8_000_000)
      const winRatePct = Math.floor(45 + rand() * 45)
      const address = makeAddress(idx)
      const aiTagsCount = variant === 'recommended' ? 2 : 1
      const aiTags = Array.from({ length: aiTagsCount }).map(() => {
        const key = tagKeys[Math.floor(rand() * tagKeys.length)]
        const color = palette[Math.floor(rand() * palette.length)]
        return {
          key,
          color,
          bgColor: `${color}22`,
          descriptionKey: key,
        }
      })

      return {
        variant,
        address,
        handle: variant === 'recommended' ? `@trader_${idx}` : null,
        tag: null,
        totalValueUsd,
        pnlUsd,
        pnlLabelKey: 'realizedPnl',
        trades: Math.floor(20 + rand() * 480),
        positions: Math.floor(1 + rand() * 14),
        winRatePct,
        winRateLabelKey: 'winRate',
        avatarColor: palette[idx % palette.length],
        aiTags,
      }
    }

    return {
      recommended: Array.from({ length: 3 }).map((_, i) => makeTrader('recommended', i)),
      details: Array.from({ length: 18 }).map((_, i) => makeTrader('detail', i + 10)),
    } as any as WhaleDiscoverResponse
  }
}

export async function fetchTraderSnapshot(
  address: string,
  query: FetchTraderSnapshotQuery = {},
): Promise<TraderSnapshotResponse> {
  try {
    return await apiCall(async () => {
      const searchParams = new URLSearchParams()
      if (query.skipCache === true) searchParams.set('skipCache', 'true')
      const queryString = searchParams.toString()
      const fallbackUrl =
        queryString.length > 0
          ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot?${queryString}`
          : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot`

      return cachedRequest(
        `trader-snapshot:${address}:${query.skipCache ? 'skip' : 'cache'}`,
        () =>
          safeApiCall(
            () =>
              client.WhaleTrackingController_getTraderSnapshot({
                params: { address },
                queries: query.skipCache ? { skipCache: true } : {},
                headers: optionalAuthHeaders(),
              }),
            {
              url: fallbackUrl,
              options: {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  ...optionalAuthHeaders(),
                },
              },
              validateResponse: data =>
                unwrapResponse<TraderSnapshotResponse>(
                  data as TraderSnapshotResponse | BaseResponse<TraderSnapshotResponse>,
                ),
            },
          ),
        CacheTTL.MEDIUM,
      )
    }, 'FETCH_TRADER_SNAPSHOT')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error

    const rand = mulberry32(hashStringToSeed(`trader-snapshot:${address}`))
    const totalAccountValue = Math.floor(3_000_000 + rand() ** 0.35 * 120_000_000)
    const perpPercent = 0.35 + rand() * 0.55
    const spotPercent = 1 - perpPercent
    const perpAccountValue = totalAccountValue * perpPercent
    const spotAccountValue = totalAccountValue * spotPercent
    const marginUsagePercent = 25 + rand() * 60
    const withdrawable = perpAccountValue * (1 - marginUsagePercent / 100) * (0.55 + rand() * 0.35)
    const leverageRatio = 1 + rand() * 8
    const totalPositionValue = perpAccountValue * leverageRatio
    const totalMarginUsed = perpAccountValue * (marginUsagePercent / 100)
    const unrealizedPnl = (rand() - 0.5) * perpAccountValue * 0.18
    const roi = (unrealizedPnl / Math.max(1, totalMarginUsed)) * 100

    const spotCoins = ['USDC', 'BTC', 'ETH', 'SOL']
    const weights = spotCoins.map(() => 0.2 + rand() * 1.2)
    const weightSum = weights.reduce((a, b) => a + b, 0)
    const balances = spotCoins.map((coin, idx) => {
      const share = weights[idx] / weightSum
      const value = spotAccountValue * share
      const price = coin === 'BTC' ? 65_000 : coin === 'ETH' ? 3_200 : coin === 'SOL' ? 130 : 1
      const total = value / price
      const hold = total * (rand() * 0.15)
      return { coin, total, hold, value, sharePercent: share * 100 }
    })

    return {
      perp: { accountValue: perpAccountValue, totalMarginUsed, totalPositionValue, withdrawable, marginUsagePercent, leverageRatio, unrealizedPnl, roi },
      spot: { totalValue: spotAccountValue, balances },
      total: { accountValue: totalAccountValue, perpPercent: perpPercent * 100, spotPercent: spotPercent * 100 },
    } as any as TraderSnapshotResponse
  }
}

export async function fetchTraderPositions(
  address: string,
  query: FetchTraderPositionsQuery = {},
): Promise<TraderPositionsResponse> {
  try {
    return await apiCall(async () => {
      const { type = 'all', skipCache = false } = query
      const searchParams = new URLSearchParams()
      if (type) searchParams.set('type', type)
      if (skipCache) searchParams.set('skipCache', 'true')
      const queryString = searchParams.toString()
      const fallbackUrl =
        queryString.length > 0
          ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions?${queryString}`
          : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions`

      return cachedRequest(
        `trader-positions:${address}:${type}:${skipCache ? 'skip' : 'cache'}`,
        () =>
          safeApiCall(
            () =>
              client.WhaleTrackingController_getTraderPositions({
                params: { address },
                queries: { type, ...(skipCache ? { skipCache: true } : {}) },
                headers: optionalAuthHeaders(),
              }),
            {
              url: fallbackUrl,
              options: {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  ...optionalAuthHeaders(),
                },
              },
              validateResponse: data =>
                unwrapResponse<TraderPositionsResponse>(
                  data as TraderPositionsResponse | BaseResponse<TraderPositionsResponse>,
                ),
            },
          ),
        CacheTTL.MEDIUM,
      )
    }, 'FETCH_TRADER_POSITIONS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const type = query.type ?? 'all'
    const rand = mulberry32(hashStringToSeed(`trader-positions:${address}:${type}`))
    const basePrices: Record<string, number> = { BTC: 65_000, ETH: 3_200, SOL: 130, XRP: 0.62 }
    const perpCoins = ['BTC', 'ETH', 'SOL', 'XRP']
    const spotCoins = ['USDC', 'BTC', 'ETH', 'SOL']
    const now = Date.now()

    const makePerp = (coin: string, idx: number) => {
      const side = rand() > 0.52 ? 'LONG' : 'SHORT'
      const entryPrice = basePrices[coin] * (0.9 + rand() * 0.2)
      const markPrice = entryPrice * (0.92 + rand() * 0.16)
      const leverageValue = 2 + Math.floor(rand() * 10)
      const marginUsed = Math.floor(30_000 + rand() ** 0.4 * 1_500_000)
      const positionValue = marginUsed * leverageValue * (side === 'SHORT' ? -1 : 1)
      const sizeAbs = Math.abs(positionValue) / markPrice
      const size = Number((sizeAbs * (side === 'SHORT' ? -1 : 1)).toFixed(6))
      const liquidationPrice =
        side === 'LONG' ? entryPrice * (0.68 + rand() * 0.12) : entryPrice * (1.12 + rand() * 0.22)
      const unrealizedPnl = (markPrice - entryPrice) * sizeAbs * (side === 'LONG' ? 1 : -1)
      const unrealizedPnlPercent = (unrealizedPnl / Math.max(1, marginUsed)) * 100
      const fundingRate = (rand() - 0.5) * 25
      const roi = (unrealizedPnl / Math.max(1, marginUsed)) * 100

      return {
        coin,
        side,
        size,
        entryPrice,
        markPrice,
        liquidationPrice,
        positionValue,
        marginUsed,
        leverage: { type: rand() > 0.5 ? 'cross' : 'isolated', value: leverageValue },
        unrealizedPnl,
        unrealizedPnlPercent,
        fundingRate,
        roi,
        updatedAt: new Date(now - idx * 6 * 60_000).toISOString(),
      }
    }

    const makeSpot = (coin: string) => {
      const price = basePrices[coin] ?? 1
      const value = Math.floor(10_000 + rand() ** 0.5 * 2_500_000)
      const total = value / price
      const hold = total * (rand() * 0.12)
      return { coin, total, hold, available: Math.max(0, total - hold), value }
    }

    return {
      type,
      perp: type === 'spot' ? [] : perpCoins.slice(0, 3).map(makePerp),
      spot: type === 'perp' ? [] : spotCoins.slice(0, 4).map(makeSpot),
    } as any as TraderPositionsResponse
  }
}

export async function fetchTraderOpenOrders(
  address: string,
  query: FetchTraderOpenOrdersQuery = {},
): Promise<TraderOpenOrdersResponse> {
  try {
    return await apiCall(async () => {
      const { coin, skipCache = false } = query
      const searchParams = new URLSearchParams()
      if (coin) searchParams.set('coin', coin)
      if (skipCache) searchParams.set('skipCache', 'true')
      const queryString = searchParams.toString()
      const fallbackUrl =
        queryString.length > 0
          ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/open-orders?${queryString}`
          : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/open-orders`

      return cachedRequest(
        `trader-open-orders:${address}:${coin ?? 'all'}:${skipCache ? 'skip' : 'cache'}`,
        () =>
          safeApiCall(
            () => fetchTraderOpenOrdersFromHyperliquid(address, { coin }),
            {
              url: fallbackUrl,
              options: {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
              },
              validateResponse: data =>
                unwrapResponse<TraderOpenOrdersResponse>(
                  data as TraderOpenOrdersResponse | BaseResponse<TraderOpenOrdersResponse>,
                ),
            },
          ),
        CacheTTL.SHORT,
      )
    }, 'FETCH_TRADER_OPEN_ORDERS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const coinFilter = query.coin
    const rand = mulberry32(hashStringToSeed(`trader-open-orders:${address}:${coinFilter ?? 'all'}`))
    const symbols = (coinFilter ? [coinFilter] : ['BTC', 'ETH', 'SOL']).map(coin => `${coin}-PERP`)
    const now = Date.now()

    return {
      orders: Array.from({ length: Math.min(symbols.length * 2, 8) }).map((_, idx) => {
        const symbol = symbols[idx % symbols.length]
        const side = rand() > 0.5 ? 'BUY' : 'SELL'
        const basePrice = symbol.startsWith('BTC') ? 65_000 : symbol.startsWith('ETH') ? 3_200 : 130
        const price = basePrice * (0.94 + rand() * 0.12)
        const size = 0.05 + rand() * 3
        return {
          orderId: `mock-order-${idx}`,
          symbol,
          side,
          price,
          size,
          status: 'OPEN',
          createdAt: new Date(now - idx * 5 * 60_000).toISOString(),
        }
      }),
    } as any as TraderOpenOrdersResponse
  }
}

export async function fetchRealtimeWhaleAlerts(
  params: FetchRealtimeWhaleAlertsParams = {},
): Promise<RealtimeWhaleAlertItem[]> {
  try {
    return await apiCall(async () => {
      const queries: Record<string, unknown> = {}
      if (params.symbol) queries.symbol = params.symbol
      if (typeof params.minPositionValueUsd === 'number') queries.min_position_value_usd = params.minPositionValueUsd
      if (typeof params.limit === 'number') queries.limit = params.limit
      if (params.since) queries.since = params.since

      const searchParams = new URLSearchParams()
      if (params.symbol) searchParams.set('symbol', params.symbol)
      if (typeof params.minPositionValueUsd === 'number') searchParams.set('min_position_value_usd', String(params.minPositionValueUsd))
      if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit))
      if (params.since) searchParams.set('since', params.since)
      const queryString = searchParams.toString()
      const fallbackUrl = queryString.length > 0
        ? `${API_BASE_URL}/whale-alerts/realtime?${queryString}`
        : `${API_BASE_URL}/whale-alerts/realtime`

      return safeApiCall<RealtimeWhaleAlertItem[]>(
        async () =>
          unwrapPaginatedItems<RealtimeWhaleAlertItem>(
            await client.WhaleAlertController_getRealtime({
              headers: optionalAuthHeaders(),
              queries,
            }),
          ),
        {
          url: fallbackUrl,
          options: {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
          },
          validateResponse: data =>
            unwrapPaginatedItems(
              data as PaginatedItemsResponse<RealtimeWhaleAlertItem> | BaseResponse<PaginatedItemsResponse<RealtimeWhaleAlertItem>>,
            ),
        },
      )
    }, 'FETCH_REALTIME_WHALE_ALERTS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const symbol = params.symbol || 'BTC'
    const limit = params.limit ?? 50
    const rand = mulberry32(hashStringToSeed(`whale-realtime:${symbol}:${params.minPositionValueUsd ?? ''}`))
    const sides = ['Long', 'Short'] as const
    const now = Date.now()

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16).toString(16).padStart(16, '0')
      return `0x${a}${idx.toString(16).padStart(4, '0')}`
    }

    return Array.from({ length: Math.min(limit, 80) }).map((_, idx) => {
      const side = sides[Math.floor(rand() * sides.length)]
      const basePrice = symbol === 'BTC' ? 65_000 : symbol === 'ETH' ? 3_200 : 120
      const entryPrice = basePrice * (0.92 + rand() * 0.16)
      const positionValueUsd = Math.floor((params.minPositionValueUsd ?? 1_000_000) * (1 + rand() * 12))
      const positionSize = (positionValueUsd / entryPrice) * (side === 'Short' ? -1 : 1)
      const minutesAgo = Math.floor(rand() * 60)
      return {
        user_address: makeAddress(idx),
        symbol,
        side,
        position_action: rand() > 0.5 ? 1 : 2,
        position_value_usd: String(positionValueUsd),
        position_size: Number(positionSize.toFixed(6)),
        entry_price: String(entryPrice.toFixed(2)),
        create_time: new Date(now - minutesAgo * 60_000).toISOString(),
      } as any as RealtimeWhaleAlertItem
    })
  }
}

export async function fetchWhaleTradesRealtime(
  params: FetchWhaleTradesRealtimeParams = {},
): Promise<WhaleTradeDto[]> {
  try {
    return await apiCall(async () => {
      const queries: Record<string, unknown> = {}
      if (params.symbol) queries.symbol = params.symbol
      if (typeof params.minTradeValueUsd === 'number') queries.min_trade_value_usd = params.minTradeValueUsd
      if (typeof params.limit === 'number') queries.limit = params.limit
      if (params.since) queries.since = params.since

      const searchParams = new URLSearchParams()
      if (params.symbol) searchParams.set('symbol', params.symbol)
      if (typeof params.minTradeValueUsd === 'number') searchParams.set('min_trade_value_usd', String(params.minTradeValueUsd))
      if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit))
      if (params.since) searchParams.set('since', params.since)
      const queryString = searchParams.toString()
      const fallbackUrl = queryString.length > 0
        ? `${API_BASE_URL}/whale-alerts/trades?${queryString}`
        : `${API_BASE_URL}/whale-alerts/trades`

      return safeApiCall<WhaleTradeDto[]>(
        async () =>
          unwrapPaginatedItems<WhaleTradeDto>(
            await client.WhaleAlertController_getWhaleTrades({
              headers: optionalAuthHeaders(),
              queries,
            }),
          ),
        {
          url: fallbackUrl,
          options: {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...optionalAuthHeaders() },
          },
          validateResponse: data =>
            unwrapPaginatedItems(
              data as PaginatedItemsResponse<WhaleTradeDto> | BaseResponse<PaginatedItemsResponse<WhaleTradeDto>>,
            ),
        },
      )
    }, 'FETCH_WHALE_TRADES_REALTIME')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const symbol = params.symbol || 'BTC'
    const limit = params.limit ?? 50
    const rand = mulberry32(hashStringToSeed(`whale-trades:${symbol}:${params.minTradeValueUsd ?? ''}`))
    const sides = ['Long', 'Short'] as const
    const now = Date.now()

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16).toString(16).padStart(16, '0')
      return `0x${a}${idx.toString(16).padStart(4, '0')}`
    }

    return Array.from({ length: Math.min(limit, 80) }).map((_, idx) => {
      const side = sides[Math.floor(rand() * sides.length)]
      const basePrice = symbol === 'BTC' ? 65_000 : symbol === 'ETH' ? 3_200 : 120
      const price = basePrice * (0.92 + rand() * 0.16)
      const tradeValueUsd = Math.floor((params.minTradeValueUsd ?? 1_000_000) * (1 + rand() * 10))
      const tradeSize = (tradeValueUsd / price) * (side === 'Short' ? -1 : 1)
      const minutesAgo = Math.floor(rand() * 60)

      return {
        user_address: makeAddress(idx),
        symbol,
        side,
        trade_size: Number(tradeSize.toFixed(6)),
        price: Number(price.toFixed(2)),
        trade_value_usd: Number(tradeValueUsd.toFixed(2)),
        trade_time: new Date(now - minutesAgo * 60_000).toISOString(),
      } as WhaleTradeDto
    })
  }
}

export async function fetchUserPortfolio(
  address: string,
  query: FetchUserPortfolioQuery = {},
): Promise<UserPortfolioResponse> {
  try {
    return await apiCall(async () => {
      if (query.skipCache) {
        return fetchUserPortfolioFromHyperliquid(address)
      }

      return cachedRequest(
        `user-portfolio:${address}`,
        () => fetchUserPortfolioFromHyperliquid(address),
        CacheTTL.LONG,
      )
    }, 'FETCH_USER_PORTFOLIO')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`portfolio:${address}`))
    const now = Date.now()
    const points = 100
    const step = 3600 * 1000
    const history = Array.from({ length: points }).map((_, i) => {
      const time = now - (points - i) * step
      const value = 1000000 + Math.sin(i / 10) * 200000 + rand() * 50000
      return { time, value }
    })
    return {
      address,
      history,
      currentValue: history[points - 1].value,
      pnl24h: 12500,
      pnlPercent24h: 1.25,
    } as any as UserPortfolioResponse
  }
}

export async function fetchUserFills(
  address: string,
  query: FetchUserFillsQuery = {},
): Promise<UserFillsResponse> {
  try {
    return await apiCall(async () => {
      const { aggregateByTime = false, skipCache = false } = query
      if (skipCache) {
        return fetchUserFillsFromHyperliquid(address, { aggregateByTime })
      }

      const cacheKey = `user-fills:${address}:${aggregateByTime ? 'agg' : 'raw'}`
      return cachedRequest(
        cacheKey,
        () => fetchUserFillsFromHyperliquid(address, { aggregateByTime }),
        CacheTTL.MEDIUM,
      )
    }, 'FETCH_USER_FILLS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return { fills: [] } as any as UserFillsResponse
  }
}

export async function fetchTraderFullData(
  address: string,
  query: FetchTraderFullDataQuery = {},
): Promise<TraderFullDataResponse> {
  try {
    return await apiCall(async () => {
      const { aggregateByTime = false, skipCache = false } = query
      const cacheKey = `trader-full-data:${address}:${aggregateByTime ? 'agg' : 'raw'}`
      if (skipCache) {
        return fetchTraderFullDataFromHyperliquid(address, { aggregateByTime })
      }

      return cachedRequest(
        cacheKey,
        () => fetchTraderFullDataFromHyperliquid(address, { aggregateByTime }),
        CacheTTL.SHORT,
      )
    }, 'FETCH_TRADER_FULL_DATA')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return {
      summary: {
        address,
        totalValue: 1250000,
        pnl: 450000,
        roi: 15.5,
        winRate: 0.68,
        trades: 156,
      },
      positions: [],
      history: [],
    } as any as TraderFullDataResponse
  }
}
