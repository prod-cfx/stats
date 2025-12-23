import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'

import { cachedRequest, CacheKeys, CacheTTL, clearCache, invalidateCache } from './api-cache'
import {
  API_BASE_URL,
  buildCachedFetchOptions,
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

export type CreateExchangeAccountPayload = Infer<typeof schemas.CreateExchangeAccountDto>
export type ExchangeAccountResponse = Infer<typeof schemas.ExchangeAccountResponseDto>

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

// ===== 策略实例相关 API（已被 LLM 实例接口替代）=====
/**
 * @deprecated 前端已统一使用 LLM 实例接口（fetchLlmStrategyInstances），
 *             新功能请勿再使用基于 strategy-instances 的客户端方法。
 */
export interface StrategyInstanceSignalsQuery {
  limit?: number
}

export type TradingSignalResponse = Infer<typeof schemas.StrategyInstanceSignalPublicResponseDto>

/**
 * @deprecated 请改用 fetchLlmStrategyInstances
 */
export async function fetchStrategyInstances(query?: {
  page?: number
  limit?: number
  llmModel?: string
  strategyTemplateId?: string
}) {
  return cachedRequest(
    CacheKeys.strategyList(query),
    () => apiCall(async () => {
      const response = await client.UserStrategyInstancesController_list({
        headers: optionalAuthHeaders(),  // 支持匿名访问
        queries: {
          page: query?.page || 1,
          limit: query?.limit || 20,
          llmModel: query?.llmModel,
          strategyTemplateId: query?.strategyTemplateId,
        },
      })
      return unwrapResponse(response)
    }, 'FETCH_STRATEGY_INSTANCES'),
    CacheTTL.MEDIUM // 30秒缓存
  )
}

/**
 * @deprecated 请改用 fetchLlmStrategyInstanceDetail
 */
export async function fetchStrategyInstanceDetail(id: string) {
  // 验证ID格式，防止路径注入
  validateId(id, 'strategy instance ID')
  
  return cachedRequest(
    CacheKeys.strategyInstance(id),
    () => apiCall(async () => {
      // 直接使用 fetch 确保 headers 正确传递
      const response = await fetch(`${API_BASE_URL}/strategy-instances/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...optionalAuthHeaders(),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return unwrapResponse(data)
    }, `FETCH_STRATEGY_DETAIL:${id}`),
    CacheTTL.SHORT // 10秒缓存（订阅状态需要较快更新）
  )
}

/**
 * @deprecated 请改用 fetchLlmStrategyInstanceSignals（后端 LLM 信号实现稳定后）
 */
export async function fetchStrategyInstanceSignals(
  id: string,
  query: StrategyInstanceSignalsQuery = {},
): Promise<PaginatedResponse<TradingSignalResponse>> {
  validateId(id, 'strategy instance ID')

  return apiCall(async () => {
    const response = await client.UserStrategyInstancesController_listSignals({
      headers: optionalAuthHeaders(),
      params: { id },
      queries: {
        page: 1,
        limit: query.limit && query.limit > 0 ? query.limit : 20,
      },
    })

    return unwrapResponse(response) as PaginatedResponse<TradingSignalResponse>
  }, `FETCH_STRATEGY_SIGNALS:${id}`)
}

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
 * 当前后端仅返回空列表，占位用于未来将 LLM run → 交易信号的持久化打通。
 * 前端不应依赖返回结构做复杂展示逻辑。
 */
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

// ===== 用户订阅相关 API（旧版策略实例订阅，已被 LLM 订阅替代）=====
type CreateSubscriptionPayload = Infer<typeof schemas.CreateSubscriptionDto>

/**
 * @deprecated 前端已统一使用 createLlmSubscription
 */
export async function createSubscription(payload: CreateSubscriptionPayload) {
  const result = await apiCall(async () => {
    return safeApiCall(
      () => client.UserStrategySubscriptionsController_subscribe(payload, {
        headers: requireAuthHeaders(),
      }),
      {
        url: `${API_BASE_URL}/user/strategy-subscriptions`,
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
  }, 'CREATE_SUBSCRIPTION')
  
  // 清除相关缓存
  clearCache(CacheKeys.strategyInstance(payload.strategyInstanceId))
  invalidateCache('subscription-list:')
  
  return result
}

/**
 * @deprecated 前端已统一使用 fetchMyLlmSubscriptions
 */
export async function fetchMySubscriptions(query?: {
  page?: number
  limit?: number
  status?: 'active' | 'paused' | 'cancelled'
}) {
  return cachedRequest(
    CacheKeys.subscriptionList(query),
    () => apiCall(async () => {
      const response = await client.UserStrategySubscriptionsController_listMySubscriptions({
        headers: requireAuthHeaders(),
        queries: {
          page: query?.page || 1,
          limit: query?.limit || 20,
          status: query?.status,
        },
      })
      return unwrapResponse(response)
    }, 'FETCH_MY_SUBSCRIPTIONS'),
    CacheTTL.SHORT // 10秒缓存
  )
}

/**
 * @deprecated 前端已统一使用 fetchLlmSubscriptionDetail
 */
export async function fetchSubscriptionDetail(subscriptionId: string) {
  return apiCall(async () => {
    validateId(subscriptionId, 'subscription ID')
    
    return safeApiCall(
      () => client.UserStrategySubscriptionsController_detail({
        headers: requireAuthHeaders(),
        params: { subscriptionId },
      }),
      {
        url: `${API_BASE_URL}/user/strategy-subscriptions/${subscriptionId}`,
        options: {
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
          ...buildCachedFetchOptions(30, [`subscription-${subscriptionId}`]),
        },
        validateResponse: (data) => unwrapResponse(data),
      }
    )
  }, `FETCH_SUBSCRIPTION_DETAIL:${subscriptionId}`)
}

type UpdateSubscriptionPayload = Infer<typeof schemas.UpdateSubscriptionDto>

/**
 * @deprecated 前端已统一使用 updateLlmSubscription
 */
export async function updateSubscription(
  subscriptionId: string,
  payload: UpdateSubscriptionPayload
) {
  validateId(subscriptionId, 'subscription ID')
  
  const result = await apiCall(async () => {
    return safeApiCall(
      () => client.UserStrategySubscriptionsController_update(
        payload,
        {
          headers: requireAuthHeaders(),
          params: { subscriptionId },
        }
      ),
      {
        url: `${API_BASE_URL}/user/strategy-subscriptions/${subscriptionId}`,
        options: {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...requireAuthHeaders(),
          },
          body: JSON.stringify(payload),
        },
        validateResponse: (data) => unwrapResponse(data),
      }
    )
  }, `UPDATE_SUBSCRIPTION:${subscriptionId}`)
  
  // 清除相关缓存
  clearCache(CacheKeys.subscription(subscriptionId))
  invalidateCache('subscription-list:')
  
  return result
}

/**
 * @deprecated 前端已统一使用 cancelLlmSubscription
 */
export async function cancelSubscription(subscriptionId: string) {
  validateId(subscriptionId, 'subscription ID')
  
  await apiCall(async () => {
    await safeApiCall(
      () => client.UserStrategySubscriptionsController_cancel({
        headers: requireAuthHeaders(),
        params: { subscriptionId },
      }),
      {
        url: `${API_BASE_URL}/user/strategy-subscriptions/${subscriptionId}`,
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
  }, `CANCEL_SUBSCRIPTION:${subscriptionId}`)
  
  // 清除相关缓存
  clearCache(CacheKeys.subscription(subscriptionId))
  invalidateCache('subscription-list:')
  invalidateCache('strategy-instance:')
}

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
