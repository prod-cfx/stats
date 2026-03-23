import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'

import type {
  TraderFullDataResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from './hyperliquid-api'
import {
  getStrategyById,
  listStrategies as listMockStrategies,
  updateStrategyStatus as updateMockStrategyStatus,
} from '@/components/account/ai-quant-strategy-store'
import { cachedRequest, CacheTTL } from './api-cache'
import { API_BASE_URL, client, safeApiCall, unwrapApiResponse, validateId } from './api-client'
import { getToken } from './auth-storage'
import { ApiError, AuthenticationError, logError } from './errors'
import {
  fetchTraderFullData as fetchTraderFullDataFromHyperliquid,
  fetchTraderOpenOrdersFromHyperliquid,
  fetchUserFillsFromHyperliquid,
  fetchUserPortfolioFromHyperliquid,
} from './hyperliquid-api'

// Re-export types for external use
export type {
  TraderFullDataResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from './hyperliquid-api'

type Infer<T extends ZodTypeAny> = T['_output']

type LoginPayload = Infer<typeof schemas.LoginRequestDto>
type RegisterPayload = Infer<typeof schemas.RegisterRequestDto>
type PasswordResetRequestPayload = Infer<typeof schemas.PasswordResetRequestDto>
type VerifyResetPayload = Infer<typeof schemas.VerifyPasswordResetRequestDto>
type SendVerificationCodePayload = Infer<typeof schemas.SendVerificationCodeRequestDto>

const IS_NON_PROD =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV !== 'production'
const ENABLE_ACCOUNT_AI_QUANT_MOCK_FALLBACK =
  process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK !== 'false'

function getHttpStatusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  if (!('response' in error)) return undefined

  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') return undefined

  const status = (response as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function shouldFallbackToMock(error: unknown): boolean {
  if (!IS_NON_PROD) return false
  // Auth errors should continue to bubble for UI to handle (e.g. show login prompt)
  if (error instanceof AuthenticationError) return false
  return true
}

function shouldFallbackToAccountAiQuantMock(error: unknown): boolean {
  if (error instanceof AuthenticationError) return false
  if (ENABLE_ACCOUNT_AI_QUANT_MOCK_FALLBACK) return true
  return shouldFallbackToMock(error)
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

export type CreateExchangeAccountPayload = Infer<typeof schemas.CreateExchangeConfigDto>
export type ExchangeAccountResponse = Infer<typeof schemas.ExchangeConfigResponseDto>
export type PredictionMarketCardResponse = Infer<typeof schemas.PredictionMarketCardDto>
export type RealtimeWhaleAlertItem = Infer<typeof schemas.RealtimeWhaleAlertDto>
export type WhaleTradeDto = Infer<typeof schemas.WhaleTradeDto>
export type WhaleDiscoverResponse = Infer<typeof schemas.WhaleDiscoverResponseDto>
export type WhaleDiscoverTraderAiTag = Infer<typeof schemas.WhaleDiscoverTraderAiTagDto>
export type UserExchangeId = 'binance' | 'okx' | 'hyperliquid'

export interface UserExchangeAccountStatus {
  id: string | null
  exchangeId: UserExchangeId
  isBound: boolean
  name: string | null
  maskedCredential: string | null
  isTestnet: boolean | null
  lastValidatedAt: string | Date | null
  createdAt: string | Date | null
}

export interface UpsertUserExchangeAccountPayload {
  exchangeId: UserExchangeId
  name?: string
  isTestnet?: boolean
  marketType?: 'spot' | 'perp'
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  mainWalletAddress?: string
  agentPrivateKey?: string
}

interface BaseResponse<T> {
  data?: T
  message?: string
}

// 使用统一的unwrapApiResponse
function unwrapResponse<T>(response: T | BaseResponse<T>): T {
  return unwrapApiResponse(response)
}

function extractBackendErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object')
    return fallback

  const candidate = payload as {
    error?: { args?: { reasonMessage?: unknown } }
    message?: unknown
  }

  if (typeof candidate.error?.args?.reasonMessage === 'string' && candidate.error.args.reasonMessage.trim()) {
    return candidate.error.args.reasonMessage
  }

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
  }

  return fallback
}

async function requestAccountExchangeAccounts<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/account/exchange-accounts${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...requireAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const code = payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'code' in payload.error
      ? String((payload.error as { code?: unknown }).code ?? 'API_ERROR')
      : 'API_ERROR'
    const message = extractBackendErrorMessage(payload, response.statusText || '操作失败')
    throw new ApiError(message, code, response.status, payload)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json()
  return unwrapApiResponse(payload) as T
}

export async function fetchUserExchangeAccountStatuses(): Promise<UserExchangeAccountStatus[]> {
  return apiCall(
    () => requestAccountExchangeAccounts<UserExchangeAccountStatus[]>(''),
    'FETCH_USER_EXCHANGE_ACCOUNT_STATUSES',
  )
}

export async function upsertUserExchangeAccount(
  payload: UpsertUserExchangeAccountPayload,
): Promise<UserExchangeAccountStatus> {
  return apiCall(
    () =>
      requestAccountExchangeAccounts<UserExchangeAccountStatus>('', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    'UPSERT_USER_EXCHANGE_ACCOUNT',
  )
}

export async function deleteUserExchangeAccount(exchangeId: UserExchangeId): Promise<void> {
  return apiCall(
    () =>
      requestAccountExchangeAccounts<void>(`/${exchangeId}`, {
        method: 'DELETE',
      }),
    'DELETE_USER_EXCHANGE_ACCOUNT',
  )
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
async function apiCall<T>(operation: () => Promise<T>, context: string): Promise<T> {
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
          responseData,
        )
      }
    }

    // Wrap other errors in ApiError
    if (error instanceof Error) {
      throw new ApiError(error.message || '操作失败', 'API_ERROR', undefined, error)
    }

    throw new ApiError('未知错误', 'UNKNOWN_ERROR')
  }
}

// ===== 鲸鱼持仓（whale-tracking/holdings）相关 API =====

export type WhaleHoldingApiItem = Infer<typeof schemas.WhaleHoldingDto>

export interface FetchWhaleHoldingsQuery {
  symbol?: string
  minPositionValueUsd?: number
  // timeRangeHours 已不再使用，因为 HyperliquidWhalePosition 表只保留最新快照
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
      const entryPrice =
        symbol === 'BTC'
          ? 40_000 + rand() * 40_000
          : symbol === 'ETH'
            ? 1_500 + rand() * 2_500
            : 50 + rand() * 200
      const positionSize = positionValueUsd / entryPrice
      const liquidationPrice =
        entryPrice * (side === 'LONG' ? 0.75 + rand() * 0.15 : 1.15 + rand() * 0.25)
      // 生成模拟的 pnl 和 roe
      const pnl = (rand() * 2 - 1) * positionValueUsd * 0.1 // [-10%, +10%) 的盈亏
      const roe = pnl / positionValueUsd
      const snapshotTime = new Date(Date.now() - Math.floor(rand() * 24 * 60) * 60_000).toISOString()
      return {
        userAddress: `0x${Math.floor(rand() * 1e16)
          .toString(16)
          .padStart(16, '0')}${idx.toString(16).padStart(4, '0')}`,
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
    return items
  }
}
// ===== 鲸鱼地址维度历史交易 / 绩效 API =====

export type WhaleAddressPerformanceResponse = Infer<
  typeof schemas.WhaleAddressPerformanceResponseDto
>

export interface FetchWhaleAddressPerformanceQuery {
  timeRangeDays?: number
  symbol?: string
  limit?: number
}

export type TraderDiscoverTagsResponse = Infer<typeof schemas.TraderDiscoverTagsResponseDto>

export interface FetchTraderDiscoverTagsQuery {
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
        ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(
            address,
          )}/discover-tags?${search}`
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
      return safeApiCall(
        () =>
          method({
            headers: optionalAuthHeaders(),
            params: { address },
          }),
        fallbackConfig,
      )
    }

    return safeApiCall(
      () =>
        Promise.reject(new Error('WhaleTrackingController_getTraderDiscoverTags is not available')),
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

// ===== 鲸鱼 Discover 聚合数据（whale-tracking/discover）相关 API =====

export async function fetchWhaleTrackingDiscover(): Promise<WhaleDiscoverResponse> {
  try {
    return await apiCall(async () => {
      const response = await client.WhaleTrackingController_getDiscover({
        // Discover 接口支持游客访问：存在 token 时带上认证头，否则按 VISITOR 角色访问
        headers: optionalAuthHeaders(),
      })

      return unwrapResponse(response) as WhaleDiscoverResponse
    }, 'FETCH_WHALE_TRACKING_DISCOVER')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    // Mock payload: keep Whale Discover page functional when backend is unavailable.
    const rand = mulberry32(hashStringToSeed('whale-discover'))

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16)
        .toString(16)
        .padStart(16, '0')
      return `0x${a}${idx.toString(16).padStart(4, '0')}`
    }

    const palette = ['#60a5fa', '#c084fc', '#34d399', '#fbbf24', '#fb7185']
    const tagKeys = [
      'bullWarGod',
      'swingKing',
      'smartTrader',
      'treasuryKeeper',
      'twitterKol',
    ] as const

    const makeTrader = (variant: 'recommended' | 'detail', idx: number) => {
      const totalValueUsd = Math.floor(500_000 + rand() ** 0.35 * 50_000_000)
      const pnlUsd = Math.floor((rand() - 0.45) * 8_000_000)
      const winRatePct = Math.floor(45 + rand() * 45)
      const address = makeAddress(idx)
      const aiTagsCount = variant === 'recommended' ? 2 : 1
      const aiTags = Array.from({ length: aiTagsCount }).map((_, _k) => {
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

    const recommended = Array.from({ length: 3 }).map((_, i) => makeTrader('recommended', i))
    const details = Array.from({ length: 18 }).map((_, i) => makeTrader('detail', i + 10))

    return {
      recommended,
      details,
    } as any as WhaleDiscoverResponse
  }
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
  try {
    return await apiCall(async () => {
      const searchParams = new URLSearchParams()
      if (query.skipCache === true) {
        searchParams.set('skipCache', 'true')
      }
      const queryString = searchParams.toString()
      const fallbackUrl =
        queryString.length > 0
          ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot?${queryString}`
          : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/snapshot`

      // 如果需要跳过缓存，直接调用 Hyperliquid API
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
      return {
        coin,
        total,
        hold,
        value,
        sharePercent: share * 100,
      }
    })

    return {
      perp: {
        accountValue: perpAccountValue,
        totalMarginUsed,
        totalPositionValue,
        withdrawable,
        marginUsagePercent,
        leverageRatio,
        unrealizedPnl,
        roi,
      },
      spot: {
        totalValue: spotAccountValue,
        balances,
      },
      total: {
        accountValue: totalAccountValue,
        perpPercent: perpPercent * 100,
        spotPercent: spotPercent * 100,
      },
    } as any as TraderSnapshotResponse
  }
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
  try {
    return await apiCall(async () => {
      const { type = 'all', skipCache = false } = query

      const searchParams = new URLSearchParams()
      if (type) {
        searchParams.set('type', type)
      }
      if (skipCache) {
        searchParams.set('skipCache', 'true')
      }
      const queryString = searchParams.toString()
      const fallbackUrl =
        queryString.length > 0
          ? `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions?${queryString}`
          : `${API_BASE_URL}/whale-tracking/traders/${encodeURIComponent(address)}/positions`

      // 使用缓存包装器（30 秒缓存）
      return cachedRequest(
        `trader-positions:${address}:${type}:${skipCache ? 'skip' : 'cache'}`,
        () =>
          safeApiCall(
            () =>
              client.WhaleTrackingController_getTraderPositions({
                params: { address },
                queries: {
                  type,
                  ...(skipCache ? { skipCache: true } : {}),
                },
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
        // Some backends include timestamp-like fields; harmless if ignored by UI.
        updatedAt: new Date(now - idx * 6 * 60_000).toISOString(),
      }
    }

    const makeSpot = (coin: string) => {
      const price = basePrices[coin] ?? 1
      const value = Math.floor(10_000 + rand() ** 0.5 * 2_500_000)
      const total = value / price
      const hold = total * (rand() * 0.12)
      return {
        coin,
        total,
        hold,
        available: Math.max(0, total - hold),
        value,
      }
    }

    const perp =
      type === 'spot'
        ? []
        : (perpCoins.slice(0, 3).map((coin, idx) => makePerp(coin, idx)) as any[])
    const spot = type === 'perp' ? [] : (spotCoins.map(coin => makeSpot(coin)) as any[])

    return {
      perp,
      spot,
    } as any as TraderPositionsResponse
  }
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
  try {
    return await apiCall(async () => {
      const { coin, skipCache = false } = query

      // 如果需要跳过缓存，直接调用 Hyperliquid API
      if (skipCache) {
        return fetchTraderOpenOrdersFromHyperliquid(address, { coin })
      }

      // 使用缓存包装器（30 秒缓存）
      const cacheKey = coin
        ? `trader-open-orders:${address}:${coin}`
        : `trader-open-orders:${address}`
      return cachedRequest(
        cacheKey,
        () => fetchTraderOpenOrdersFromHyperliquid(address, { coin }),
        CacheTTL.MEDIUM,
      )
    }, 'FETCH_TRADER_OPEN_ORDERS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error

    const coinFilter = query.coin?.toUpperCase()
    const rand = mulberry32(
      hashStringToSeed(`trader-open-orders:${address}:${coinFilter ?? 'all'}`),
    )
    const basePrices: Record<string, number> = { BTC: 65_000, ETH: 3_200, SOL: 130, XRP: 0.62 }
    const coins = ['BTC', 'ETH', 'SOL', 'XRP']
    const now = Date.now()

    const orders = Array.from({ length: 16 })
      .map((_, idx) => {
        const coin = coins[Math.floor(rand() * coins.length)]
        const side = rand() > 0.5 ? 'BUY' : 'SELL'
        const price = basePrices[coin] * (0.92 + rand() * 0.16)
        const origSize = Number((0.05 + rand() * 2.5).toFixed(4))
        const size = Number((origSize * (0.4 + rand() * 0.6)).toFixed(4))
        const value = price * size
        const triggerPrice =
          rand() > 0.75 ? Number((price * (0.98 + rand() * 0.04)).toFixed(2)) : null
        const timestamp = new Date(now - idx * 7 * 60_000).toISOString()

        return {
          orderId: 10_000 + idx,
          coin,
          side,
          type: triggerPrice ? 'STOP_LIMIT' : 'LIMIT',
          price: Number(price.toFixed(2)),
          size,
          origSize,
          value: Number(value.toFixed(2)),
          timestamp,
          triggerPrice,
        }
      })
      .filter(o => !coinFilter || o.coin === coinFilter)

    return {
      orders,
    } as any as TraderOpenOrdersResponse
  }
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
  try {
    return await apiCall(async () => {
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
          validateResponse: data =>
            unwrapApiResponse<RealtimeWhaleAlertItem[]>(
              data as unknown as RealtimeWhaleAlertItem[] | BaseResponse<RealtimeWhaleAlertItem[]>,
            ),
        },
      )
    }, 'FETCH_REALTIME_WHALE_ALERTS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error

    const symbol = params.symbol || 'BTC'
    const limit = params.limit ?? 50
    const rand = mulberry32(
      hashStringToSeed(`whale-realtime:${symbol}:${params.minPositionValueUsd ?? ''}`),
    )
    const sides = ['Long', 'Short'] as const
    const now = Date.now()

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16)
        .toString(16)
        .padStart(16, '0')
      return `0x${a}${idx.toString(16).padStart(4, '0')}`
    }

    const items = Array.from({ length: Math.min(limit, 80) }).map((_, idx) => {
      const side = sides[Math.floor(rand() * sides.length)]
      const basePrice = symbol === 'BTC' ? 65_000 : symbol === 'ETH' ? 3_200 : 120
      const entryPrice = basePrice * (0.92 + rand() * 0.16)
      const positionValueUsd = Math.floor(
        (params.minPositionValueUsd ?? 1_000_000) * (1 + rand() * 12),
      )
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

    return items
  }
}

export interface FetchWhaleTradesRealtimeParams {
  symbol?: string
  minTradeValueUsd?: number
  limit?: number
  since?: string
}

export async function fetchWhaleTradesRealtime(
  params: FetchWhaleTradesRealtimeParams = {},
): Promise<WhaleTradeDto[]> {
  try {
    return await apiCall(async () => {
      const queries: Record<string, unknown> = {}

      if (params.symbol) {
        queries.symbol = params.symbol
      }
      if (typeof params.minTradeValueUsd === 'number') {
        queries.min_trade_value_usd = params.minTradeValueUsd
      }
      if (typeof params.limit === 'number') {
        queries.limit = params.limit
      }
      if (params.since) {
        queries.since = params.since
      }

      const searchParams = new URLSearchParams()
      if (params.symbol) {
        searchParams.set('symbol', params.symbol)
      }
      if (typeof params.minTradeValueUsd === 'number') {
        searchParams.set('min_trade_value_usd', String(params.minTradeValueUsd))
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
          ? `${API_BASE_URL}/whale-alerts/trades?${queryString}`
          : `${API_BASE_URL}/whale-alerts/trades`

      return safeApiCall(
        () =>
          client.WhaleAlertController_getWhaleTrades({
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
          validateResponse: data =>
            unwrapApiResponse<WhaleTradeDto[]>(
              data as unknown as WhaleTradeDto[] | BaseResponse<WhaleTradeDto[]>,
            ),
        },
      )
    }, 'FETCH_WHALE_TRADES_REALTIME')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error

    const symbol = params.symbol || 'BTC'
    const limit = params.limit ?? 50
    const rand = mulberry32(
      hashStringToSeed(`whale-trades:${symbol}:${params.minTradeValueUsd ?? ''}`),
    )
    const sides = ['Long', 'Short'] as const
    const now = Date.now()

    const makeAddress = (idx: number) => {
      const a = Math.floor(rand() * 1e16)
        .toString(16)
        .padStart(16, '0')
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
      }
    })
  }
}

// ===== 多空比（markets/long-short-ratio/exchanges）相关 API =====

export type ExchangeLongShortRatioApiItem = Infer<typeof schemas.ExchangeLongShortRatioResponseDto>

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
    return unwrapResponse(response)
  }, 'FETCH_LONG_SHORT_RATIO')
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
// NOTE: These functions are currently unused and controllers do not exist in backend
// They are kept as placeholders for future implementation

// ===== Position API Types =====
// NOTE: PositionResponseDto does not exist in current contracts
// Using a local interface instead
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

export interface PaginatedResponse<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

export type AccountAiQuantStrategyStatus = 'running' | 'stopped' | 'draft'
export type AccountAiQuantStrategyAction = 'run' | 'stop'

export interface AccountAiQuantStrategyMetrics {
  returnPct: number | null
  maxDrawdownPct: number | null
  winRatePct: number | null
  tradeCount: number | null
}

export interface AccountAiQuantStrategyListItem {
  id: string
  name: string
  status: AccountAiQuantStrategyStatus
  exchange: string | null
  symbol: string | null
  timeframe: string | null
  positionPct: number | null
  isSubscribed: boolean
  metrics: AccountAiQuantStrategyMetrics
  updatedAt: string
}

export interface AccountAiQuantStrategyEquityPoint {
  ts: string
  value: number
}

export interface AccountAiQuantStrategyTimelineEvent {
  at: string
  eventType: 'system' | 'trade'
  event: string
  note?: string | null
}

export interface AccountAiQuantStrategySnapshot {
  exchange: string | null
  symbol: string | null
  timeframe: string | null
  positionPct: number | null
  deployAccountName?: string | null
  deployAt?: string | null
}

export interface AccountAiQuantStrategyDetail extends AccountAiQuantStrategyListItem {
  totalPnl: number | null
  todayPnl: number | null
  equitySeries: AccountAiQuantStrategyEquityPoint[]
  snapshot: AccountAiQuantStrategySnapshot
  timeline: AccountAiQuantStrategyTimelineEvent[]
}

interface AccountAiQuantListQuery {
  userId: string
  page?: number
  limit?: number
  status?: AccountAiQuantStrategyStatus
}

export interface AccountAiQuantDeployPayload {
  userId: string
  name: string
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  timeframe: string
  positionPct: number
  exchangeAccountId?: string
  exchangeAccountName?: string
}

function buildMockAccountAiQuantListResponse(
  query: AccountAiQuantListQuery,
): PaginatedResponse<AccountAiQuantStrategyListItem> {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const all = listMockStrategies()
    .filter(item => !query.status || item.status === query.status)
    .map(mapMockStrategyToListItem)
  const start = (page - 1) * limit
  const items = all.slice(start, start + limit)
  return {
    total: all.length,
    page,
    limit,
    items,
  }
}

function mapMockStrategyToListItem(item: ReturnType<typeof listMockStrategies>[number]): AccountAiQuantStrategyListItem {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    exchange: item.exchange,
    symbol: item.symbol,
    timeframe: item.timeframe,
    positionPct: item.positionPct,
    isSubscribed: true,
    metrics: {
      returnPct: item.metrics.returnPct,
      maxDrawdownPct: item.metrics.maxDrawdownPct,
      winRatePct: item.metrics.winRatePct,
      tradeCount: item.metrics.tradeCount,
    },
    updatedAt: item.updatedAt,
  }
}

function mapMockStrategyToDetail(item: ReturnType<typeof getStrategyById>): AccountAiQuantStrategyDetail {
  if (!item) {
    throw new ApiError('策略不存在', 'ACCOUNT_AI_QUANT_NOT_FOUND', 404)
  }

  return {
    ...mapMockStrategyToListItem(item),
    totalPnl: item.totalPnl ?? null,
    todayPnl: item.todayPnl ?? null,
    equitySeries: item.equitySeries.map(point => ({
      ts: point.ts,
      value: point.value,
    })),
    snapshot: {
      exchange: item.exchange,
      symbol: item.symbol,
      timeframe: item.timeframe,
      positionPct: item.positionPct,
      deployAccountName: item.deploy?.accountName ?? null,
      deployAt: item.deploy?.at ?? null,
    },
    timeline: item.timeline.map(event => ({
      at: event.at,
      eventType: 'system',
      event: event.event,
      note: event.note ?? null,
    })),
  }
}

function buildAccountAiQuantHeaders(userId?: string) {
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
    ...optionalAuthHeaders(),
  }
}

async function parseAccountAiQuantJson(response: Response, fallbackMessage: string) {
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new ApiError(
      parseApiErrorMessage(response.status, json, fallbackMessage),
      'ACCOUNT_AI_QUANT_REQUEST_FAILED',
      response.status,
      json,
    )
  }

  return json
}

export async function fetchAccountAiQuantStrategies(
  query: AccountAiQuantListQuery,
): Promise<PaginatedResponse<AccountAiQuantStrategyListItem>> {
  try {
    return await apiCall(async () => {
      if (!query.userId?.trim()) {
        throw new ApiError('userId is required', 'INVALID_INPUT')
      }

      const search = new URLSearchParams({
        userId: query.userId.trim(),
        page: String(query.page ?? 1),
        limit: String(query.limit ?? 20),
      })
      if (query.status) search.set('status', query.status)

      const response = await fetch(`${API_BASE_URL}/account/ai-quant/strategies?${search.toString()}`, {
        method: 'GET',
        headers: buildAccountAiQuantHeaders(query.userId.trim()),
      })
      const json = await parseAccountAiQuantJson(response, '获取 AI 量化策略列表失败')
      const remote = unwrapResponse<PaginatedResponse<AccountAiQuantStrategyListItem>>(
        json as PaginatedResponse<AccountAiQuantStrategyListItem> | BaseResponse<PaginatedResponse<AccountAiQuantStrategyListItem>>,
      )

      if (!ENABLE_ACCOUNT_AI_QUANT_MOCK_FALLBACK) {
        return remote
      }

      const mock = buildMockAccountAiQuantListResponse(query)
      if (mock.total === 0) {
        return remote
      }
      if (remote.total === 0) {
        return mock
      }

      const mergedById = new Map<string, AccountAiQuantStrategyListItem>()
      for (const item of remote.items) mergedById.set(item.id, item)
      for (const item of mock.items) {
        if (!mergedById.has(item.id)) mergedById.set(item.id, item)
      }
      const mergedItems = Array.from(mergedById.values())
      const mergedTotal = new Set([
        ...remote.items.map(item => item.id),
        ...mock.items.map(item => item.id),
      ]).size

      return {
        total: mergedTotal,
        page: remote.page,
        limit: remote.limit,
        items: mergedItems.slice(0, remote.limit),
      }
    }, 'FETCH_ACCOUNT_AI_QUANT_STRATEGIES')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    return buildMockAccountAiQuantListResponse(query)
  }
}

export async function fetchAccountAiQuantStrategyDetail(
  strategyId: string,
  userId: string,
): Promise<AccountAiQuantStrategyDetail> {
  try {
    return await apiCall(async () => {
      validateId(strategyId, 'strategy ID')
      if (!userId?.trim()) {
        throw new ApiError('userId is required', 'INVALID_INPUT')
      }

      const search = new URLSearchParams({ userId: userId.trim() })
      const response = await fetch(
        `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}?${search.toString()}`,
        {
          method: 'GET',
          headers: buildAccountAiQuantHeaders(userId.trim()),
        },
      )
      const json = await parseAccountAiQuantJson(response, '获取 AI 量化策略详情失败')
      return unwrapResponse<AccountAiQuantStrategyDetail>(
        json as AccountAiQuantStrategyDetail | BaseResponse<AccountAiQuantStrategyDetail>,
      )
    }, 'FETCH_ACCOUNT_AI_QUANT_STRATEGY_DETAIL')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    return mapMockStrategyToDetail(getStrategyById(strategyId))
  }
}

export async function performAccountAiQuantStrategyAction(
  strategyId: string,
  payload: { userId: string; action: AccountAiQuantStrategyAction },
): Promise<AccountAiQuantStrategyDetail> {
  try {
    return await apiCall(async () => {
      validateId(strategyId, 'strategy ID')
      if (!payload.userId?.trim()) {
        throw new ApiError('userId is required', 'INVALID_INPUT')
      }

      const response = await fetch(
        `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}/actions`,
        {
          method: 'POST',
          headers: buildAccountAiQuantHeaders(payload.userId.trim()),
          body: JSON.stringify({
            userId: payload.userId.trim(),
            action: payload.action,
          }),
        },
      )
      const json = await parseAccountAiQuantJson(response, '执行策略动作失败')
      return unwrapResponse<AccountAiQuantStrategyDetail>(
        json as AccountAiQuantStrategyDetail | BaseResponse<AccountAiQuantStrategyDetail>,
      )
    }, 'PERFORM_ACCOUNT_AI_QUANT_STRATEGY_ACTION')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    updateMockStrategyStatus(strategyId, payload.action === 'run' ? 'running' : 'stopped')
    return mapMockStrategyToDetail(getStrategyById(strategyId))
  }
}

export async function deployAccountAiQuantStrategy(
  payload: AccountAiQuantDeployPayload,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    if (!payload.userId?.trim()) {
      throw new ApiError('userId is required', 'INVALID_INPUT')
    }
    if (!payload.name?.trim()) {
      throw new ApiError('name is required', 'INVALID_INPUT')
    }

    const response = await fetch(`${API_BASE_URL}/account/ai-quant/strategies/deploy`, {
      method: 'POST',
      headers: buildAccountAiQuantHeaders(payload.userId.trim()),
      body: JSON.stringify({
        userId: payload.userId.trim(),
        name: payload.name.trim(),
        exchange: payload.exchange,
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        positionPct: payload.positionPct,
        exchangeAccountId: payload.exchangeAccountId,
        exchangeAccountName: payload.exchangeAccountName,
      }),
    })
    const json = await parseAccountAiQuantJson(response, '部署策略失败')
    return unwrapResponse<AccountAiQuantStrategyDetail>(
      json as AccountAiQuantStrategyDetail | BaseResponse<AccountAiQuantStrategyDetail>,
    )
  }, 'DEPLOY_ACCOUNT_AI_QUANT_STRATEGY')
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
    const response = await client.AggregatedLiquidationController_getSummary({
      headers: optionalAuthHeaders(),
      queries: { symbol },
    })
    return unwrapResponse(response) as AggregatedLiquidationSummary
  } catch (error) {
    const status = getHttpStatusFromError(error)
    // 后端数据尚未同步时会返回 404；这不是“页面错误”，按空数据处理即可。
    if (status === 404) {
      return { symbol, items: [] }
    }
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
    // 后端无数据时返回 404；前端用 0 值占位，避免整块 UI 进入 error state。
    if (status === 404) {
      return {
        symbol,
        timeframe,
        rows: [
          {
            exchange: 'TOTAL',
            symbol,
            timeframe,
            amountUsd: 0,
            longUsd: 0,
            shortUsd: 0,
            longShare: 0,
            isTotal: true,
          },
        ],
      }
    }
    if (!shouldFallbackToMock(error)) throw error
    const rand = mulberry32(hashStringToSeed(`liq-ex:${symbol}:${timeframe}`))
    const venues = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Deribit']
    const rows: ExchangeLiquidationRow[] = venues.map(ex => {
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
        {
          symbol: 'MSTR',
          assetSymbol: 'BTC',
          exchange: 'NASDAQ',
          name: 'MicroStrategy Incorporated',
        },
        { symbol: 'CRCL', assetSymbol: 'USDC', exchange: 'NYSE', name: 'Circle Internet Group' },
        { symbol: 'BMNR', assetSymbol: 'ETH', exchange: 'NYSE', name: 'BitMine Immersion' },
        {
          symbol: 'BTDR',
          assetSymbol: 'BCH',
          exchange: 'NASDAQ',
          name: 'Bitdeer Technologies Group',
        },
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

export interface PositionsQueryParams {
  page?: number
  limit?: number
  accountId?: string
  symbol?: string
  positionSide?: 'LONG' | 'SHORT'
}

// NOTE: PositionsController methods do not exist in current backend
// These functions return empty data until controllers are implemented

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

// NOTE: StrategyInstanceSignalPublicResponseDto does not exist in contracts
// Using a generic type until the DTO is added
export type TradingSignalResponse = Record<string, unknown>

// NOTE: All LLM strategy and subscription controller methods do not exist in current backend
// These functions are stubs that will be implemented when the backend controllers are added

export interface LlmStrategyInstanceSignalsQuery {
  page?: number
  limit?: number
}

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

export interface LlmCodegenSessionResponse {
  id: string
  status: string
  missingFields?: string[]
  scriptCode?: string | null
  specDesc?: Record<string, unknown> | null
  rejectReason?: string | null
  assistantPrompt?: string
}

export interface StartLlmCodegenSessionPayload {
  userId: string
  initialMessage?: string
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
}

export interface ContinueLlmCodegenSessionPayload {
  userId: string
  message: string
  confirmGenerate?: boolean
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

function parseApiErrorMessage(status: number, payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim().length > 0) return message
    const error = (payload as Record<string, unknown>).error
    if (typeof error === 'string' && error.trim().length > 0) return error
    if (error && typeof error === 'object') {
      const nested = (error as Record<string, unknown>).message
      if (typeof nested === 'string' && nested.trim().length > 0) return nested
    }
  }
  return `${fallback} (HTTP ${status})`
}

async function postLlmCodegen<T>(path: string, payload: unknown): Promise<T> {
  const token = getToken()
  const isTransientStatus = (status: number) => status === 408 || status === 429 || status >= 500
  const request = async () => fetch(`${API_BASE_URL}/llm-strategy-codegen${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request()
      let json: unknown = null
      try {
        json = await response.json()
      } catch {
        json = null
      }

      if (!response.ok) {
        if (attempt === 0 && isTransientStatus(response.status)) {
          continue
        }
        const message = parseApiErrorMessage(response.status, json, 'LLM 策略生成请求失败')
        throw new ApiError(message, 'LLM_CODEGEN_ERROR', response.status, json)
      }

      return unwrapResponse<T>(json as T | BaseResponse<T>)
    } catch (error) {
      if (attempt === 0) {
        continue
      }
      throw error
    }
  }

  throw new ApiError('LLM 策略生成请求失败', 'LLM_CODEGEN_ERROR')
}

export async function startLlmCodegenSession(
  payload: StartLlmCodegenSessionPayload,
): Promise<LlmCodegenSessionResponse> {
  if (!payload.userId.trim()) {
    throw new ApiError('userId is required', 'INVALID_INPUT')
  }
  return postLlmCodegen<LlmCodegenSessionResponse>('/sessions', payload)
}

export async function continueLlmCodegenSession(
  sessionId: string,
  payload: ContinueLlmCodegenSessionPayload,
): Promise<LlmCodegenSessionResponse> {
  validateId(sessionId, 'llm codegen session ID')
  if (!payload.userId.trim()) {
    throw new ApiError('userId is required', 'INVALID_INPUT')
  }
  if (!payload.message.trim()) {
    throw new ApiError('message is required', 'INVALID_INPUT')
  }
  return postLlmCodegen<LlmCodegenSessionResponse>(
    `/sessions/${sessionId}/messages`,
    payload,
  )
}

export async function fetchLlmStrategyInstances(query?: {
  page?: number
  limit?: number
  llmModel?: string
  strategyId?: string
}): Promise<PaginatedResponse<UserLlmStrategyInstanceResponse>> {
  return {
    total: 0,
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    items: [],
  }
}

export async function fetchLlmStrategyInstanceDetail(
  id: string,
): Promise<UserLlmStrategyInstanceResponse | null> {
  validateId(id, 'llm strategy instance ID')
  return null
}

export async function fetchLlmStrategyInstanceSignals(
  id: string,
  query: LlmStrategyInstanceSignalsQuery = {},
): Promise<PaginatedResponse<Record<string, unknown>>> {
  validateId(id, 'llm strategy instance ID')
  return {
    total: 0,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    items: [],
  }
}

export interface CreateLlmSubscriptionPayload {
  llmStrategyInstanceId: string
  customParams?: Record<string, unknown>
  exchangeAccountId?: string
}

export interface LlmSubscriptionResponse {
  id: string
  llmStrategyInstanceId: string
  status: 'active' | 'paused' | 'cancelled'
  createdAt: string
}

export async function createLlmSubscription(
  _payload: CreateLlmSubscriptionPayload,
): Promise<LlmSubscriptionResponse | null> {
  return null
}

export async function fetchMyLlmSubscriptions(query?: {
  page?: number
  limit?: number
  status?: 'active' | 'paused' | 'cancelled'
}): Promise<PaginatedResponse<LlmSubscriptionResponse>> {
  return {
    total: 0,
    page: query?.page ?? 1,
    limit: query?.limit ?? 20,
    items: [],
  }
}

export async function fetchLlmSubscriptionDetail(
  subscriptionId: string,
): Promise<LlmSubscriptionResponse | null> {
  validateId(subscriptionId, 'llm subscription ID')
  return null
}

export async function updateLlmSubscription(
  subscriptionId: string,
  _payload: {
    status?: 'active' | 'paused' | 'cancelled'
    customParams?: Record<string, unknown> | null
    exchangeAccountId?: string | null
  },
): Promise<LlmSubscriptionResponse | null> {
  validateId(subscriptionId, 'llm subscription ID')
  return null
}

export async function cancelLlmSubscription(subscriptionId: string): Promise<void> {
  validateId(subscriptionId, 'llm subscription ID')
}

// ===== 预测市场（Polymarket）相关 API =====

export interface FetchPredictionMarketsParams {
  category?: string
  onlyActive?: boolean
  limit?: number
  page?: number
  locale?: string
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
    const rand = mulberry32(
      hashStringToSeed(`pm:${params.category ?? 'all'}:${params.onlyActive ? '1' : '0'}`),
    )
    const count = params.limit ?? 48
    return Array.from({ length: Math.min(count, 24) }).map((_, idx) => {
      const probA = 0.1 + rand() * 0.8
      const probB = 1 - probA
      return {
        id: `mock-${idx}`,
        title:
          idx % 2 === 0
            ? 'What price will Bitcoin hit in 2026?'
            : 'Will the Fed cut rates this year?',
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
    const seed = hashStringToSeed(
      `ob:${params.base}:${params.type}:${params.venues ?? ''}:${params.tickSize ?? ''}`,
    )
    const rand = mulberry32(seed)
    const mid = params.base === 'BTC' ? 65_000 + rand() * 8_000 : 2_500 + rand() * 300
    const tick = params.tickSize ?? (params.base === 'BTC' ? 1 : 0.5)
    const venues = (params.venues ? params.venues.split(',') : ['binance', 'bybit', 'okx']).slice(
      0,
      5,
    )

    const buildSide = (dir: 'ask' | 'bid'): AggregatedOrderbookLevel[] => {
      return Array.from({ length: Math.min(depth, 80) }).map((_, i) => {
        const price = dir === 'ask' ? mid + tick * (i + 1) : mid - tick * (i + 1)
        const sizeTotal = 0.15 + rand() ** 0.4 * 18
        const details = venues.map(v => ({ venueId: v, size: sizeTotal * (0.15 + rand() * 0.5) }))
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
      (_, i) =>
        ({
          symbol: query.symbol,
          exchange: query.exchange || 'Binance',
          openInterest: 1e8 + rand() * 5e8,
          timestamp: new Date(now - i * 3600_000).toISOString(),
        }) as unknown as OpenInterestApiItem,
    )
  }
}

// ===== 用户历史数据（Portfolio + Fills）API =====

export interface FetchUserPortfolioQuery {
  skipCache?: boolean
}

/**
 * 获取用户投资组合历史数据（账户价值曲线、盈亏曲线）
 */
export async function fetchUserPortfolio(
  address: string,
  query: FetchUserPortfolioQuery = {},
): Promise<UserPortfolioResponse> {
  try {
    return await apiCall(async () => {
      // 如果需要跳过缓存，直接调用 Hyperliquid API
      if (query.skipCache) {
        return fetchUserPortfolioFromHyperliquid(address)
      }

      // 使用缓存包装器（5 分钟缓存，历史数据更新较慢）
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

export interface FetchUserFillsQuery {
  aggregateByTime?: boolean
  skipCache?: boolean
}

/**
 * 获取用户成交记录（用于计算胜率、平仓次数等统计指标）
 */
export async function fetchUserFills(
  address: string,
  query: FetchUserFillsQuery = {},
): Promise<UserFillsResponse> {
  try {
    return await apiCall(async () => {
      const { aggregateByTime = false, skipCache = false } = query

      // 如果需要跳过缓存，直接调用 Hyperliquid API
      if (skipCache) {
        return fetchUserFillsFromHyperliquid(address, { aggregateByTime })
      }

      // 使用缓存包装器（1 分钟缓存）
      const cacheKey = `user-fills:${address}:${aggregateByTime ? 'agg' : 'raw'}`
      return cachedRequest(
        cacheKey,
        () => fetchUserFillsFromHyperliquid(address, { aggregateByTime }),
        CacheTTL.MEDIUM,
      )
    }, 'FETCH_USER_FILLS')
  } catch (error) {
    if (!shouldFallbackToMock(error)) throw error
    return {
      fills: [],
    } as any as UserFillsResponse
  }
}

export interface FetchTraderFullDataQuery {
  aggregateByTime?: boolean
  skipCache?: boolean
}

export async function fetchTraderFullData(
  address: string,
  query: FetchTraderFullDataQuery = {},
): Promise<TraderFullDataResponse> {
  try {
    return await apiCall(async () => {
      const { aggregateByTime = false, skipCache = false } = query
      const cacheKey = `trader-full-data:${address}:${aggregateByTime ? 'agg' : 'raw'}`

      // 如果需要跳过缓存，直接调用 Hyperliquid API
      if (skipCache) {
        return fetchTraderFullDataFromHyperliquid(address, { aggregateByTime })
      }

      // 使用缓存包装器（cachedRequest 内置去重逻辑，无需额外 pendingRequests）
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

// ============================================================================
// K 线数据 API
// ============================================================================

export interface FetchKlineDataParams {
  symbol: string
  interval: string
  from: number // 秒
  to: number // 秒
  exchange?: string
}

export interface KlineBar {
  time: number // 毫秒时间戳
  open: number
  high: number
  low: number
  close: number
  volume: number
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
    // 降级到 mock（由 mockDatafeed 处理）
    return []
  }
}

// ============================================================================
// 市场行情数据 API (Ticker)
// ============================================================================

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

// ============================================================================
// 聚合成交量（24h Volume）API
// ============================================================================

export interface FetchAggregatedVolumeQuery {
  symbol: string
  instrumentType?: 'SPOT' | 'PERPETUAL'
  page?: number
  limit?: number
}

// 与后端 AggregatedVolumeResponseDto 对齐的最小字段集合
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
    // 在非生产环境或可回退场景下，返回空列表，由调用方决定是否使用本地 mock
    return {
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      items: [],
    }
  }
}
