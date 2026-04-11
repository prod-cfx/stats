import { createApiClient } from '@ai/api-contracts'
import { getErrorHttpStatus, unwrapTransportResponse } from '@ai/shared'
import { SERVER_API_BASE_URL } from './api-client'
import { buildServerAuthHeaders, getServerAuthHeaders, getServerToken } from './server-auth'

const serverClient = createApiClient(SERVER_API_BASE_URL, { validate: 'request' })
const typedServerClient = serverClient as any

export type UserLlmStrategyInstanceResponse = any

interface PaginationParams {
  page: number
  limit: number
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BacktestJobResultSummary {
  netProfit: number
  netProfitPct: number
  maxDrawdownPct: number
  winRate: number
  profitFactor: number
  totalTrades: number
}

export interface BacktestJobResultEquityPoint {
  ts: number
  equity: number
}

export interface BacktestJobResultTradeRecord {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  qty: number
  fee: number
  pnl: number
  returnPct: number
}

export interface BacktestJobResultReport {
  summary: BacktestJobResultSummary
  equityCurve?: BacktestJobResultEquityPoint[]
  trades?: BacktestJobResultTradeRecord[]
}

export interface BacktestJobServerResponse {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  inputSummary?: unknown
  resultSummary?: BacktestJobResultSummary
}

function unwrapResponse<T>(response: T | { data?: T; message?: string }): T {
  return unwrapTransportResponse(response)
}

function buildBacktestServerHeaders(token: string | null, requestId: string): Record<string, string> {
  return {
    ...buildServerAuthHeaders(token),
    'x-request-id': requestId,
  }
}

async function callPublicServerApi<T>(
  authorizedCall: () => Promise<unknown>,
  anonymousCall: () => Promise<unknown>,
  authHeaders: Record<string, string>,
): Promise<T> {
  try {
    const response = await authorizedCall()
    return unwrapResponse(response as T | { data?: T; message?: string })
  } catch (error) {
    const status = getErrorHttpStatus(error)
    if ((status === 401 || status === 403) && authHeaders.Authorization) {
      console.warn('[server-api] Token invalid, retrying as anonymous request')
      const response = await anonymousCall()
      return unwrapResponse(response as T | { data?: T; message?: string })
    }
    throw error
  }
}

/**
 * 在服务端获取 LLM 策略实例列表
 * 支持匿名访问，登录用户会看到 isSubscribed 状态
 *
 * 注意：如果 token 失效（401/403），会自动降级为匿名请求重试
 * 这确保公开页面不会因为残留的过期 cookie 而无法访问
 */
export async function fetchLlmStrategyInstancesServer(
  params: PaginationParams,
): Promise<PaginatedResponse<UserLlmStrategyInstanceResponse>> {
  const authHeaders = await getServerAuthHeaders()
  return callPublicServerApi<PaginatedResponse<UserLlmStrategyInstanceResponse>>(
    () =>
      typedServerClient.LlmStrategyInstancesController_list({
        headers: authHeaders,
        queries: {
          page: params.page,
          limit: params.limit,
        },
      }),
    () =>
      typedServerClient.LlmStrategyInstancesController_list({
        queries: {
          page: params.page,
          limit: params.limit,
        },
      }),
    authHeaders,
  )
}

/**
 * 在服务端获取 LLM 策略实例详情
 * 支持匿名访问，登录用户会看到 isSubscribed 状态
 *
 * 注意：如果 token 失效（401/403），会自动降级为匿名请求重试
 * 这确保公开页面不会因为残留的过期 cookie 而无法访问
 */
export async function fetchLlmStrategyInstanceDetailServer(
  id: string,
): Promise<UserLlmStrategyInstanceResponse> {
  const authHeaders = await getServerAuthHeaders()
  return callPublicServerApi<UserLlmStrategyInstanceResponse>(
    () =>
      typedServerClient.LlmStrategyInstancesController_detail({
        headers: authHeaders,
        params: { id },
      }),
    () =>
      typedServerClient.LlmStrategyInstancesController_detail({
        params: { id },
      }),
    authHeaders,
  )
}

export async function fetchBacktestJobResultServer(
  jobId: string,
): Promise<BacktestJobResultReport | null> {
  const token = await getServerToken()
  const authHeaders = buildBacktestServerHeaders(token, `ssr-backtest-result:${jobId}`)
  if (!authHeaders.Authorization) {
    return null
  }

  const response = await typedServerClient.BacktestingProxyController_getJobResult({
    headers: authHeaders,
    params: { id: jobId },
  })
  const payload = unwrapResponse<BacktestJobResultReport | null>(
    response as unknown as BacktestJobResultReport | { data?: BacktestJobResultReport | null; message?: string },
  )
  if (!payload?.summary) {
    return null
  }
  return payload
}

export async function fetchBacktestJobServer(
  jobId: string,
): Promise<BacktestJobServerResponse | null> {
  const token = await getServerToken()
  const authHeaders = buildBacktestServerHeaders(token, `ssr-backtest-job:${jobId}`)
  if (!authHeaders.Authorization) {
    return null
  }

  const response = await typedServerClient.BacktestingProxyController_getJob({
    headers: authHeaders,
    params: { id: jobId },
  })
  const payload = unwrapResponse<BacktestJobServerResponse | null>(
    response as unknown as BacktestJobServerResponse | { data?: BacktestJobServerResponse | null; message?: string },
  )
  if (!payload?.id || !payload?.status) {
    return null
  }
  return payload
}
