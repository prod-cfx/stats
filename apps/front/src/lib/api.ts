import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'

import { CacheKeys, clearCache, invalidateCache } from './api-cache'
import {
  API_BASE_URL,
  client,
  safeApiCall,
  unwrapApiResponse,
  validateId,
} from './api-client'
import { getToken } from './auth-storage'
import { ApiError, AuthenticationError, logError } from './errors'

type Infer<T extends ZodTypeAny> = T['_output']

type LoginPayload = Infer<typeof schemas.LoginRequestDto>
type RegisterPayload = Infer<typeof schemas.RegisterRequestDto>
type PasswordResetRequestPayload = Infer<typeof schemas.PasswordResetRequestDto>
type VerifyResetPayload = Infer<typeof schemas.VerifyPasswordResetRequestDto>
type SendVerificationCodePayload = Infer<typeof schemas.SendVerificationCodeRequestDto>

const IS_NON_PROD = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV !== 'production'

function shouldFallbackToMock(error: unknown): boolean {
  if (!IS_NON_PROD) return false
  // Auth errors should continue to bubble for UI to handle (e.g. show login prompt)
  if (error instanceof AuthenticationError) return false
  return true
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export type CreateExchangeAccountPayload = Infer<typeof schemas.CreateExchangeAccountDto>
export type ExchangeAccountResponse = Infer<typeof schemas.ExchangeAccountResponseDto>
export type PredictionMarketCardResponse = Infer<typeof schemas.PredictionMarketCardDto>
export type RealtimeWhaleAlertItem = Infer<typeof schemas.RealtimeWhaleAlertDto>
export type WhaleDiscoverResponse = Infer<typeof schemas.WhaleDiscoverResponseDto>

interface BaseResponse<T> {
  data?: T
  message?: string
}

interface ClosePositionRequest {
  userStrategyAccountId: string
  positionId: string
  quantity: string
  exchangeId: string
  marketType: string
  note?: string
}

interface ClosePositionResponse {
  success: boolean
  orderId: string
  positionId: string
  filledQuantity: string
  averagePrice?: string
  message: string
}

// 使用统一的unwrapApiResponse
function unwrapResponse<T>(response: T | BaseResponse<T>): T {
  return unwrapApiResponse(response)
}

/**
 * Validate JWT token format (basic structure check)
 */
function isValidJWTFormat(token: string): boolean {
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
}

/**
 * Get authentication headers, throws AuthenticationError if token is missing or invalid
 */
function requireAuthHeaders() {
  const token = getToken()
  
  if (!token) {
    throw new AuthenticationError('UNAUTHENTICATED')
  }
  
  if (!isValidJWTFormat(token)) {
    logError('INVALID_TOKEN_FORMAT', new Error('Token format validation failed'))
    throw new AuthenticationError('INVALID_TOKEN')
  }
  
  return { Authorization: `Bearer ${token}` }
}

/**
 * 可选的认证 headers
 * 如果存在 token 则返回 Authorization header，否则返回空对象
 * 用于支持匿名访问的接口（如策略列表）
 */
function optionalAuthHeaders(): Record<string, string> {
  const token = getToken()
  
  if (!token) {
    return {}
  }
  
  if (!isValidJWTFormat(token)) {
    logError('INVALID_TOKEN_FORMAT', new Error('Token format validation failed'))
    return {}
  }
  
  return { Authorization: `Bearer ${token}` }
}

/**
 * Wrapper for API calls with error handling
 */
async function apiCall<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    logError(context, error)
    
    // Re-throw authentication errors for proper handling
    if (error instanceof AuthenticationError) {
      throw error
    }
    
    // 保留已构造好的 ApiError（包含后端 error.code 等信息）
    if (error instanceof ApiError) {
      throw error
    }
    
    // 处理 Zodios/Axios 错误，从 error.response.data 中提取后端返回的错误码
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any
      const responseData = axiosError.response?.data
      
      // 检查是否有标准的错误结构 { error: { code: string, message: string } }
      if (
        responseData &&
        typeof responseData === 'object' &&
        'error' in responseData &&
        responseData.error &&
        typeof responseData.error === 'object' &&
        'code' in responseData.error &&
        typeof responseData.error.code === 'string'
      ) {
        const backendError = responseData.error as { code: string; message?: string }
        throw new ApiError(
          backendError.message || axiosError.message || '操作失败',
          backendError.code,
          axiosError.response?.status,
          responseData
        )
      }
    }
    
    // Wrap other errors in ApiError
    if (error instanceof Error) {
      throw new ApiError(
        error.message || '操作失败',
        'API_ERROR',
        undefined,
        error
      )
    }
    
    throw new ApiError('未知错误', 'UNKNOWN_ERROR')
}
}



// ===== 鲸鱼持仓（whale-tracking/holdings）相关 API =====

export type WhaleHoldingApiItem = Infer<typeof schemas.WhaleHoldingDto>

export interface FetchWhaleHoldingsQuery {
  symbol?: string
  minPositionValueUsd?: number
  timeRangeHours?: number
  limit?: number
}

export async function fetchWhaleHoldings(
  query: FetchWhaleHoldingsQuery = {},
): Promise<WhaleHoldingApiItem[]> {
  try {
    return await apiCall(async () => {
      const response = await client.WhaleHoldingsController_getWhaleHoldings({
        // 持仓接口支持游客访问：存在 token 时带上认证头，否则按 VISITOR 角色访问
        headers: optionalAuthHeaders(),
        queries: query,
      })

      return unwrapResponse(response) as WhaleHoldingApiItem[]
    }, 'FETCH_WHALE_HOLDINGS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const symbol = query.symbol || 'BTC'
    const rand = mulberry32(hashStringToSeed(`whale-holdings:${symbol}`))
    const sides = ['LONG', 'SHORT'] as const
    const items = Array.from({ length: query.limit ?? 50 }).map((_, idx) => {
      const side = sides[Math.floor(rand() * sides.length)]
      const positionValueUsd = 800_000 + rand() * 12_000_000
      const entryPrice = symbol === 'BTC'
        ? 40_000 + rand() * 40_000
        : symbol === 'ETH'
          ? 1_500 + rand() * 2_500
          : 50 + rand() * 200
      const positionSize = positionValueUsd / entryPrice
      const liquidationPrice = entryPrice * (side === 'LONG' ? (0.75 + rand() * 0.15) : (1.15 + rand() * 0.25))
      const createdAt = new Date(Date.now() - Math.floor(rand() * 24 * 60) * 60_000).toISOString()
      return {
        userAddress: `0x${Math.floor(rand() * 1e16).toString(16).padStart(16, '0')}${idx.toString(16).padStart(4, '0')}`,
        symbol,
        side,
        positionValueUsd,
        positionSize,
        entryPrice,
        liquidationPrice,
        createTime: createdAt,
      } as any as WhaleHoldingApiItem
    })
    return items
  }
}

// ===== 鲸鱼地址维度历史交易 / 绩效 API =====

export type WhaleAddressPerformanceResponse = Infer<
  (typeof schemas.WhaleAddressPerformanceResponseDto)
>

export interface FetchWhaleAddressPerformanceQuery {
  timeRangeDays?: number
  symbol?: string
  limit?: number
}

export async function fetchWhaleAddressPerformance(
  address: string,
  query: FetchWhaleAddressPerformanceQuery = {},
): Promise<WhaleAddressPerformanceResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (typeof query.timeRangeDays === 'number') {
      params.set('timeRangeDays', String(query.timeRangeDays))
    }
    if (query.symbol) {
      params.set('symbol', query.symbol)
    }
    if (typeof query.limit === 'number') {
      params.set('limit', String(query.limit))
    }

    const search = params.toString()
    const fallbackUrl =
      search.length > 0
        ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(
            address,
          )}/performance?${search}`
        : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(
            address,
          )}/performance`

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
            data as
              | WhaleAddressPerformanceResponse
              | BaseResponse<WhaleAddressPerformanceResponse>,
          ),
      },
    )

    return unwrapResponse<WhaleAddressPerformanceResponse>(
      result as
        | WhaleAddressPerformanceResponse
        | BaseResponse<WhaleAddressPerformanceResponse>,
    )
  }, 'FETCH_WHALE_ADDRESS_PERFORMANCE')
}

// ===== 鲸鱼 Discover 聚合数据（whale-tracking/discover）相关 API =====

export async function fetchWhaleTrackingDiscover(): Promise<WhaleDiscoverResponse> {
  return apiCall(async () => {
    const response = await client.WhaleTrackingController_getDiscover({
      // Discover 接口支持游客访问：存在 token 时带上认证头，否则按 VISITOR 角色访问
      headers: optionalAuthHeaders(),
    })

    return unwrapResponse(response) as WhaleDiscoverResponse
  }, 'FETCH_WHALE_TRACKING_DISCOVER')
}

// ===== 鲸鱼交易者账户快照 API =====

export type TraderSnapshotResponse = Infer<typeof schemas.TraderSnapshotResponseDto>

export interface FetchTraderSnapshotQuery {
  skipCache?: boolean
}

export async function fetchTraderSnapshot(
  address: string,
  query: FetchTraderSnapshotQuery = {},
): Promise<TraderSnapshotResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (query.skipCache) {
      params.set('skipCache', 'true')
    }

    const search = params.toString()
    const fallbackUrl = search.length > 0
      ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot?${search}`
      : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot`

    return safeApiCall(
      () =>
        client.WhaleTrackingController_getTraderSnapshot({
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
          unwrapResponse<TraderSnapshotResponse>(
            data as TraderSnapshotResponse | BaseResponse<TraderSnapshotResponse>,
          ),
      },
    )
  }, 'FETCH_TRADER_SNAPSHOT')
}

// ===== 鲸鱼交易者持仓详情 API =====

export type TraderPositionsResponse = Infer<typeof schemas.TraderPositionsResponseDto>

export interface FetchTraderPositionsQuery {
  type?: 'perp' | 'spot' | 'all'
  skipCache?: boolean
}

export async function fetchTraderPositions(
  address: string,
  query: FetchTraderPositionsQuery = {},
): Promise<TraderPositionsResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (query.type) {
      params.set('type', query.type)
    }
    if (query.skipCache) {
      params.set('skipCache', 'true')
    }

    const search = params.toString()
    const fallbackUrl = search.length > 0
      ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions?${search}`
      : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions`

    return safeApiCall(
      () =>
        client.WhaleTrackingController_getTraderPositions({
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
          unwrapResponse<TraderPositionsResponse>(
            data as TraderPositionsResponse | BaseResponse<TraderPositionsResponse>,
          ),
      },
    )
  }, 'FETCH_TRADER_POSITIONS')
}

// ===== 鲸鱼交易者挂单列表 API =====

export type TraderOpenOrdersResponse = Infer<typeof schemas.TraderOpenOrdersResponseDto>

export interface FetchTraderOpenOrdersQuery {
  coin?: string
  skipCache?: boolean
}

export async function fetchTraderOpenOrders(
  address: string,
  query: FetchTraderOpenOrdersQuery = {},
): Promise<TraderOpenOrdersResponse> {
  return apiCall(async () => {
    const params = new URLSearchParams()
    if (query.coin) {
      params.set('coin', query.coin)
    }
    if (query.skipCache) {
      params.set('skipCache', 'true')
    }

    const search = params.toString()
    const fallbackUrl = search.length > 0
      ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/open-orders?${search}`
      : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/open-orders`

    return safeApiCall(
      () =>
        client.WhaleTrackingController_getTraderOpenOrders({
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
          unwrapResponse<TraderOpenOrdersResponse>(
            data as TraderOpenOrdersResponse | BaseResponse<TraderOpenOrdersResponse>,
          ),
      },
    )
  }, 'FETCH_TRADER_OPEN_ORDERS')
}

// ===== Hyperliquid Whale Alert 实时数据 API =====

export interface FetchRealtimeWhaleAlertsParams {
  symbol?: string
  minPositionValueUsd?: number
  limit?: number
  since?: string
}

export async function fetchRealtimeWhaleAlerts(
  params: FetchRealtimeWhaleAlertsParams = {},
): Promise<RealtimeWhaleAlertItem[]> {
  return apiCall(async () => {
    const queries: Record<string, unknown> = {}

    if (params.symbol) {
      queries.symbol = params.symbol
    }
    if (typeof params.minPositionValueUsd === 'number') {
      queries.min_position_value_usd = params.minPositionValueUsd
    }
    if (typeof params.limit === 'number') {
      queries.limit = params.limit
    }
    if (params.since) {
      queries.since = params.since
    }

    // 为 fallback 构造 querystring，确保退回 fetch 时过滤条件不丢失
    const searchParams = new URLSearchParams()
    if (params.symbol) {
      searchParams.set('symbol', params.symbol)
    }
    if (typeof params.minPositionValueUsd === 'number') {
      searchParams.set('min_position_value_usd', String(params.minPositionValueUsd))
    }
    if (typeof params.limit === 'number') {
      searchParams.set('limit', String(params.limit))
    }
    if (params.since) {
      searchParams.set('since', params.since)
    }
    const queryString = searchParams.toString()
    const fallbackUrl =
      queryString.length > 0
        ? `${API_BASE_URL}/whale-alerts/realtime?${queryString}`
        : `${API_BASE_URL}/whale-alerts/realtime`

    return safeApiCall(
      () =>
        client.WhaleAlertController_getRealtime({
          headers: optionalAuthHeaders(),
          queries,
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
        validateResponse: data => unwrapApiResponse<RealtimeWhaleAlertItem[]>(data),
      },
    )
  }, 'FETCH_REALTIME_WHALE_ALERTS')
}

// ===== 多空比（markets/long-short-ratio/exchanges）相关 API =====

export type ExchangeLongShortRatioApiItem = Infer<
  typeof schemas.ExchangeLongShortRatioResponseDto
>

export type ExchangeLongShortTimeRange =
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '12h'
  | '24h'

export interface FetchExchangeLongShortRatioQuery {
  symbol: string
  timeRange: ExchangeLongShortTimeRange
}

export async function fetchExchangeLongShortRatio(
  query: FetchExchangeLongShortRatioQuery,
): Promise<ExchangeLongShortRatioApiItem[]> {
  try {
    return await apiCall(async () => {
      const response = await client.MarketsController_getExchangeLongShortRatio({
        // 多空比接口支持游客访问：存在 token 时带上认证头，否则按 VISITOR 角色访问
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


export async function login(payload: LoginPayload) {
  return apiCall(async () => {
    const response = await client.AuthController_login(payload)
    return unwrapResponse(response)
  }, 'LOGIN')
}

export async function registerAccount(payload: RegisterPayload) {
  const response = await client.AuthController_register(payload)
  return unwrapResponse(response)
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  const response = await client.AuthController_requestPasswordReset(payload)
  return unwrapResponse(response)
}

export async function verifyPasswordReset(payload: VerifyResetPayload) {
  const response = await client.AuthController_verifyPasswordReset(payload)
  return unwrapResponse(response)
}

export async function fetchProfile() {
  const response = await client.UserController_me({ headers: requireAuthHeaders() })
  return unwrapResponse(response)
}

export async function sendVerificationCode(payload: SendVerificationCodePayload) {
  const response = await client.AuthController_sendVerificationCode(payload)
  return unwrapResponse(response)
}

// ===== 交易所账户管理相关 API =====
export async function createExchangeAccount(
  payload: CreateExchangeAccountPayload
): Promise<ExchangeAccountResponse> {
  const result = await safeApiCall(
    () => client.UserExchangeAccountsController_create(payload, {
      headers: requireAuthHeaders(),
    }),
    {
      url: `${API_BASE_URL}/user/exchange-accounts`,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...requireAuthHeaders(),
        },
        body: JSON.stringify(payload),
      },
      validateResponse: (data) => unwrapResponse(data),
    }
  )
  
  // 清除交易所账户列表缓存
  clearCache(CacheKeys.exchangeAccounts())
  
  return result
}

export async function listExchangeAccounts(): Promise<ExchangeAccountResponse[]> {
  // 注意：交易所账户列表是严格的用户私有数据，不能跨用户/会话缓存
  // 否则用户 A 登出后用户 B 登录会命中 A 的缓存，导致越权数据泄露
  return apiCall(async () => {
    const response = await client.UserExchangeAccountsController_list({
      headers: requireAuthHeaders(),
    })
    return unwrapResponse(response)
  }, 'LIST_EXCHANGE_ACCOUNTS')
}

export async function deleteExchangeAccount(accountId: string): Promise<void> {
  validateId(accountId, 'exchange account ID')
  
  await safeApiCall(
    () => client.UserExchangeAccountsController_delete({
      headers: requireAuthHeaders(),
      params: { accountId },
    }),
    {
      url: `${API_BASE_URL}/user/exchange-accounts/${accountId}`,
      options: {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...requireAuthHeaders(),
        },
      },
      validateResponse: (data) => unwrapResponse(data),
    }
  )
  
  // 清除交易所账户列表缓存
  clearCache(CacheKeys.exchangeAccounts())
}

// ===== 仓位管理相关 API =====
export async function closePosition(payload: ClosePositionRequest): Promise<ClosePositionResponse> {
  try {
    const response = await client.PositionsController_closePosition(
      {
        userStrategyAccountId: payload.userStrategyAccountId,
        positionId: payload.positionId,
        quantity: payload.quantity,
        exchangeId: payload.exchangeId,
        marketType: payload.marketType,
        note: payload.note,
      },
      {
        headers: requireAuthHeaders(),
      }
    )
    return unwrapResponse(response) as ClosePositionResponse
  } catch (error: unknown) {
    // 增强错误处理
    const err = error as { response?: { status?: number } }
    if (err?.response?.status === 401) {
      throw new Error('未登录或会话已过期，请重新登录')
    }
    if (err?.response?.status === 403) {
      throw new Error('您没有权限执行此操作')
    }
    if (err?.response?.status === 404) {
      throw new Error('仓位不存在或已关闭')
    }
    throw error
  }
}

// ===== Position API Types =====
export type PositionResponse = Infer<typeof schemas.PositionResponseDto>

export interface PaginatedResponse<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

// ===== 聚合爆仓数据（Liquidation Data）API =====

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

export async function fetchAggregatedLiquidationSummary(
  symbol: string,
): Promise<AggregatedLiquidationSummary> {
  try {
    return await apiCall(async () => {
      const response = await client.AggregatedLiquidationController_getSummary({
        headers: optionalAuthHeaders(),
        queries: { symbol },
      })
      return unwrapResponse(response) as AggregatedLiquidationSummary
    }, 'FETCH_LIQUIDATION_SUMMARY')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`liq-summary:${symbol}`))
    const items: LiquidationSummaryItem[] = (['1h', '4h', '12h', '24h'] as const).map((tf) => {
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
    return await apiCall(async () => {
      const response = await client.AggregatedLiquidationController_getExchanges({
        headers: optionalAuthHeaders(),
        queries: { symbol, timeframe },
      })
      return unwrapResponse(response) as ExchangeLiquidationResponse
    }, 'FETCH_LIQUIDATION_EXCHANGES')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`liq-ex:${symbol}:${timeframe}`))
    const venues = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Deribit']
    const rows: ExchangeLiquidationRow[] = venues.map((ex) => {
      const amountUsd = 0.6e6 + rand() ** 0.4 * 22e6
      const longShare = 0.35 + rand() * 0.3
      const longUsd = amountUsd * longShare
      const shortUsd = amountUsd - longUsd
      return { exchange: ex, symbol, timeframe, amountUsd, longUsd, shortUsd, longShare }
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

// === 公共市场数据：加密股票报价（币股页面） ===

export type CryptoStockQuoteLatest = Infer<typeof schemas.CryptoStockQuoteResponseDto>

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
      if (params?.source) {
        searchParams.set('source', params.source)
      }
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
          url:
            query.length > 0
              ? `${API_BASE_URL}/crypto-stock-quotes/latest?${query}`
              : `${API_BASE_URL}/crypto-stock-quotes/latest`,
          options: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...optionalAuthHeaders(),
            },
          },
          validateResponse: data => unwrapResponse<CryptoStockQuoteLatest[]>(data),
        },
      )

      return unwrapResponse<CryptoStockQuoteLatest[]>(response)
    }, 'FETCH_CRYPTO_STOCK_QUOTES_LATEST')
  } catch (error) {
    // 对于携带过期 / 无效 token 的情况，将 ApiError(401/403) 显式转为 AuthenticationError，
    // 方便公共页面用统一逻辑回退到静态示例数据。
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      throw new AuthenticationError('TOKEN_EXPIRED')
    }
    if (shouldFallbackToMock(error)) {
      // Minimal mock payload to keep public pages functional when backend is unavailable.
      const rand = mulberry32(hashStringToSeed('crypto-stocks:latest'))
      const rows = [
        { symbol: 'PYPL', assetSymbol: 'PYUSD', exchange: 'NASDAQ', name: 'PayPal Holdings, Inc.' },
        { symbol: 'MSTR', assetSymbol: 'BTC', exchange: 'NASDAQ', name: 'MicroStrategy Incorporated' },
        { symbol: 'CRCL', assetSymbol: 'USDC', exchange: 'NYSE', name: 'Circle Internet Group' },
        { symbol: 'BMNR', assetSymbol: 'ETH', exchange: 'NYSE', name: 'BitMine Immersion' },
        { symbol: 'BTDR', assetSymbol: 'BCH', exchange: 'NASDAQ', name: 'Bitdeer Technologies Group' },
      ]
      return rows.map((r) => {
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

export interface PositionsQueryParams {
  page?: number
  limit?: number
  accountId?: string
  symbol?: string
  positionSide?: 'LONG' | 'SHORT'
}

export async function fetchOpenPositions(
  params: PositionsQueryParams = {}
): Promise<PaginatedResponse<PositionResponse>> {
  return apiCall(async () => {
    const response = await client.PositionsController_listOpenPositions({
      headers: requireAuthHeaders(),
      queries: params,
    })
    return unwrapResponse(response) as PaginatedResponse<PositionResponse>
  }, 'FETCH_OPEN_POSITIONS')
}

export async function fetchHistoricalPositions(
  params: PositionsQueryParams = {}
): Promise<PaginatedResponse<PositionResponse>> {
  return apiCall(async () => {
    const response = await client.PositionsController_listHistoricalPositions({
      headers: requireAuthHeaders(),
      queries: params,
    })
    return unwrapResponse(response) as PaginatedResponse<PositionResponse>
  }, 'FETCH_HISTORICAL_POSITIONS')
}

// ===== 旧策略实例 API 已移除（已被 LLM 实例接口替代）=====
// 前端现统一使用 fetchLlmStrategyInstances、fetchLlmStrategyInstanceDetail、fetchLlmStrategyInstanceSignals

export type TradingSignalResponse = Infer<typeof schemas.StrategyInstanceSignalPublicResponseDto>

// ===== LLM 策略实例（用户侧）相关 API =====

export interface LlmStrategyInstanceSignalsQuery {
  page?: number
  limit?: number
}

// 使用 SDK 生成的类型，避免手写接口与后端 DTO 发生漂移
export interface UserLlmStrategyInstanceResponse {
  id: string
  name: string
  description?: string | null
  strategyId: string
  strategyName?: string | null
  strategyDescription?: string | null
  llmModel: string
  createdAt?: string | null
  isSubscribed?: boolean
}

export async function fetchLlmStrategyInstances(query?: {
  page?: number
  limit?: number
  llmModel?: string
  strategyId?: string
}) {
  // 注意：该列表接口返回的每一项都包含 isSubscribed 等用户态字段，
  // 不能跨用户/会话做全局缓存，否则会导致订阅状态泄露或错乱
  return apiCall(async () => {
    const params = new URLSearchParams()
    params.set('page', String(query?.page || 1))
    params.set('limit', String(query?.limit || 20))
    if (query?.llmModel) params.set('llmModel', query.llmModel)
    if (query?.strategyId) params.set('strategyId', query.strategyId)

    return safeApiCall(
      () => client.UserLlmStrategyInstancesController_list({
        headers: optionalAuthHeaders(),
        queries: {
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          ...(query?.llmModel && { llmModel: query.llmModel }),
          ...(query?.strategyId && { strategyId: query.strategyId }),
        },
      }),
      {
        url: `${API_BASE_URL}/llm-strategy-instances?${params.toString()}`,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...optionalAuthHeaders(),
          },
        },
        validateResponse: (data) => unwrapResponse(data) as PaginatedResponse<UserLlmStrategyInstanceResponse>,
      },
    )
  }, 'FETCH_LLM_STRATEGY_INSTANCES')
}

export async function fetchLlmStrategyInstanceDetail(id: string) {
  validateId(id, 'llm strategy instance ID')

  // 注意：该接口返回的 payload 包含用户态字段（例如 isSubscribed），不能跨用户缓存
  // 否则会导致 A 用户的订阅状态被 B 用户命中缓存而泄露
  return apiCall(async () => {
    return safeApiCall(
      () => client.UserLlmStrategyInstancesController_detail({
        headers: optionalAuthHeaders(),
        params: { id },
      }),
      {
        url: `${API_BASE_URL}/llm-strategy-instances/${id}`,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...optionalAuthHeaders(),
          },
        },
        validateResponse: (data) => unwrapResponse(data) as UserLlmStrategyInstanceResponse,
      },
    )
  }, `FETCH_LLM_STRATEGY_DETAIL:${id}`)
}

/**
 * @internal
 */
// 当前后端仅返回空列表，占位用于未来将 LLM run → 交易信号的持久化打通。
// 前端不应依赖返回结构做复杂展示逻辑。
export async function fetchLlmStrategyInstanceSignals(
  id: string,
  query: LlmStrategyInstanceSignalsQuery = {},
): Promise<PaginatedResponse<Record<string, unknown>>> {
  validateId(id, 'llm strategy instance ID')

  const page = query.page || 1
  const limit = query.limit && query.limit > 0 ? query.limit : 20

  // 注意：该接口需要鉴权（requireAuthHeaders），信号数据仅订阅用户可见
  // 不能跨用户/会话缓存，否则会导致用户 A 的信号被用户 B 命中缓存而越权访问
  return apiCall(async () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))

    return safeApiCall(
      () => client.UserLlmStrategyInstancesController_listSignals({
        headers: requireAuthHeaders(),
        params: { id },
        queries: { page, limit },
      }),
      {
        url: `${API_BASE_URL}/llm-strategy-instances/${id}/signals?${params.toString()}`,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
        },
        validateResponse: (data) => unwrapResponse(data) as PaginatedResponse<Record<string, unknown>>,
      },
    )
  }, `FETCH_LLM_STRATEGY_SIGNALS:${id}`)
}

// ===== 旧版订阅 API 已移除（已被 LLM 订阅接口替代）=====
// 前端现统一使用 createLlmSubscription、fetchMyLlmSubscriptions、fetchLlmSubscriptionDetail、updateLlmSubscription、cancelLlmSubscription

// ===== 用户订阅（LLM 策略实例）相关 API =====
// 与后端 DTO / OpenAPI 完全对齐，避免手写类型漂移
export type CreateLlmSubscriptionPayload = Infer<typeof schemas.CreateLlmSubscriptionDto>

export interface LlmSubscriptionResponse {
  id: string
  llmStrategyInstanceId: string
  status: 'active' | 'paused' | 'cancelled'
  createdAt: string
}

export async function createLlmSubscription(payload: CreateLlmSubscriptionPayload) {
  const result = await apiCall(async () => {
    return safeApiCall(
      () => client.UserLlmStrategySubscriptionsController_subscribe(payload, {
        headers: requireAuthHeaders(),
      }),
      {
        url: `${API_BASE_URL}/user/llm-strategy-subscriptions`,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
          body: JSON.stringify(payload),
        },
        validateResponse: (data) => unwrapResponse(data) as LlmSubscriptionResponse,
      },
    )
  }, 'CREATE_LLM_SUBSCRIPTION')

  clearCache(CacheKeys.llmStrategyInstance(payload.llmStrategyInstanceId))
  invalidateCache('llm-subscription-list:')

  return result
}

export async function fetchMyLlmSubscriptions(query?: {
  page?: number
  limit?: number
  status?: 'active' | 'paused' | 'cancelled'
}) {
  // 注意：订阅列表是严格用户态数据，不能跨会话做全局缓存
  return apiCall(async () => {
    const params = new URLSearchParams()
    params.set('page', String(query?.page || 1))
    params.set('limit', String(query?.limit || 20))
    if (query?.status) params.set('status', query.status)

    return safeApiCall(
      () => client.UserLlmStrategySubscriptionsController_listMySubscriptions({
        headers: requireAuthHeaders(),
        queries: {
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          ...(query?.status && { status: query.status }),
        },
      }),
      {
        url: `${API_BASE_URL}/user/llm-strategy-subscriptions?${params.toString()}`,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
        },
        validateResponse: (data) => unwrapResponse(data) as PaginatedResponse<LlmSubscriptionResponse>,
      },
    )
  }, 'FETCH_MY_LLM_SUBSCRIPTIONS')
}

export async function fetchLlmSubscriptionDetail(subscriptionId: string) {
  validateId(subscriptionId, 'llm subscription ID')

  return apiCall(async () => {
    return safeApiCall(
      () => client.UserLlmStrategySubscriptionsController_detail({
        headers: requireAuthHeaders(),
        params: { subscriptionId },
      }),
      {
        url: `${API_BASE_URL}/user/llm-strategy-subscriptions/${subscriptionId}`,
        options: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
        },
        validateResponse: (data) => unwrapResponse(data) as LlmSubscriptionResponse,
      },
    )
  }, `FETCH_LLM_SUBSCRIPTION_DETAIL:${subscriptionId}`)
}

export async function updateLlmSubscription(
  subscriptionId: string,
  payload: { status?: 'active' | 'paused' | 'cancelled'; customParams?: Record<string, unknown> | null; exchangeAccountId?: string | null },
) {
  validateId(subscriptionId, 'llm subscription ID')

  const result = await apiCall(async () => {
    return safeApiCall(
      () => client.UserLlmStrategySubscriptionsController_update(payload, {
        headers: requireAuthHeaders(),
        params: { subscriptionId },
      }),
      {
        url: `${API_BASE_URL}/user/llm-strategy-subscriptions/${subscriptionId}`,
        options: {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
          body: JSON.stringify(payload),
        },
        validateResponse: (data) => unwrapResponse(data) as LlmSubscriptionResponse,
      },
    )
  }, `UPDATE_LLM_SUBSCRIPTION:${subscriptionId}`)

  clearCache(CacheKeys.llmSubscription(subscriptionId))
  invalidateCache('llm-subscription-list:')

  return result
}

export async function cancelLlmSubscription(subscriptionId: string) {
  validateId(subscriptionId, 'llm subscription ID')

  await apiCall(async () => {
    return safeApiCall(
      () => client.UserLlmStrategySubscriptionsController_cancel({
        headers: requireAuthHeaders(),
        params: { subscriptionId },
      }),
      {
        url: `${API_BASE_URL}/user/llm-strategy-subscriptions/${subscriptionId}`,
        options: {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
        },
        validateResponse: () => undefined,
      },
    )
  }, `CANCEL_LLM_SUBSCRIPTION:${subscriptionId}`)

  clearCache(CacheKeys.llmSubscription(subscriptionId))
  invalidateCache('llm-subscription-list:')
  invalidateCache('llm-strategy-instance:')
}

// ===== 预测市场（Polymarket）相关 API =====

export interface FetchPredictionMarketsParams {
  category?: string
  onlyActive?: boolean
  limit?: number
  page?: number
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
          paragraphs: [
            'This is mock data shown when the backend is unavailable.',
            'The market resolves based on publicly available sources.',
          ],
          createdAt: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
        },
      } as any as PredictionMarketCardResponse
    })
  }
}

// ===== 聚合订单簿 API =====

export type AggregatedOrderbookMarketType = 'spot' | 'perp'

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
  type: AggregatedOrderbookMarketType
  venues?: string
  depth?: number
  tickSize?: number
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

    const buildSide = (dir: 'ask' | 'bid'): AggregatedOrderbookLevel[] => {
      return Array.from({ length: Math.min(depth, 80) }).map((_, i) => {
        const price = dir === 'ask' ? mid + tick * (i + 1) : mid - tick * (i + 1)
        const sizeTotal = 0.15 + rand() ** 0.4 * 18
        const details = venues.map((v) => ({ venueId: v, size: sizeTotal * (0.15 + rand() * 0.5) }))
        return { price: Number(price.toFixed(2)), sizeTotal: Number(sizeTotal.toFixed(4)), details }
      })
    }

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

// ===== 聚合持仓量（Open Interest）API =====

export type OpenInterestApiItem = Infer<typeof schemas.OpenInterestDto>

export interface FetchAggregatedOpenInterestQuery {
  symbol: string
  exchange?: string
  limit?: number
}

export async function fetchAggregatedOpenInterest(
  query: FetchAggregatedOpenInterestQuery,
): Promise<OpenInterestApiItem[]> {
  return apiCall(async () => {
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
}
