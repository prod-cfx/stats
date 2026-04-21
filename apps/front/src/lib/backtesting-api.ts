import { buildAiQuantErrorMessage, parseAiQuantErrorMeta } from '@/components/ai-quant/ai-quant-error-stage'
import { API_BASE_URL, client, unwrapApiResponse } from '@/lib/api-client'
import { getToken } from '@/lib/auth-storage'
import { ApiError, AuthenticationError } from '@/lib/errors'

export interface BacktestCapabilities {
  allowedBaseTimeframes: string[]
}

export interface FetchBacktestCapabilitiesOptions {
  signal?: AbortSignal
}

export interface BacktestSymbolSupportCheckInput {
  exchange: string
  marketType: 'spot' | 'perp'
  symbol: string
  baseTimeframe: string
}

export interface BacktestSymbolSupportCheckPayload {
  status: string
  reasonCode?: string
  args?: Record<string, unknown>
}

export type BacktestJobPhase = 'queued' | 'running' | 'succeeded' | 'failed'

export interface CreateBacktestJobPayload {
  symbols: string[]
  baseTimeframe: string
  stateTimeframes: string[]
  initialCash: number
  leverage?: number
  execution: {
    slippageBps: number
    feeBps: number
    priceSource: 'open' | 'close' | 'mid'
  }
  strategy: {
    id: string
    protocolVersion?: 'v1'
    publishedSnapshotId?: string
    params?: Record<string, unknown>
  }
  dataRange: {
    fromTs: number
    toTs: number
  }
  allowPartial?: boolean
  bars?: unknown[]
}

export interface BacktestJob {
  id: string
  status: BacktestJobPhase
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  errorDetails?: {
    code?: string
    message: string
    args?: Record<string, unknown>
  }
  resultSummary?: BacktestJobResult['summary']
}

export interface BacktestJobResult {
  summary: {
    netProfit: number
    netProfitPct: number
    maxDrawdownPct: number
    winRate: number
    profitFactor: number | null
    totalTrades: number
    totalOpenTrades?: number
    openPnl?: number
  }
  equityCurve?: Array<{
    ts: number
    equity: number
  }>
  trades?: Array<{
    id: string
    symbol?: string
    side: 'LONG' | 'SHORT'
    entryTs?: number
    entryPrice?: number
    exitTs: number
    exitPrice: number
    qty?: number
    fee?: number
    pnl?: number
    returnPct: number
    reasonOpen?: string
    reasonClose?: string
  }>
  openPositions?: Array<{
    symbol: string
    qty: number
    avgEntryPrice: number
    unrealizedPnl: number
  }>
}

const JWT_FORMAT_REGEX = /^[\w-]+\.[\w-]+\.[\w-]+$/
export const BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS = 12_000
export const BACKTEST_REQUEST_TIMEOUT_MS = 12_000
const BACKTEST_CAPABILITY_RETRY_ATTEMPTS = 3
const BACKTEST_CAPABILITY_RETRY_DELAY_MS = 400
const VALID_BACKTEST_JOB_PHASES = new Set<BacktestJobPhase>([
  'queued',
  'running',
  'succeeded',
  'failed',
])

function waitRetryDelay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('Request aborted', 'API_ERROR'))
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const onAbort = () => {
      if (timer) {
        globalThis.clearTimeout(timer)
      }
      signal?.removeEventListener('abort', onAbort)
      reject(new ApiError('Request aborted', 'API_ERROR'))
    }

    timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, BACKTEST_CAPABILITY_RETRY_DELAY_MS)

    signal?.addEventListener('abort', onAbort)
  })
}

function extractErrorCode(payload: unknown): string {
  const meta = parseAiQuantErrorMeta(payload)
  return meta.code ?? 'API_ERROR'
}

function requireAuthHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) {
    throw new AuthenticationError('UNAUTHENTICATED')
  }
  if (!JWT_FORMAT_REGEX.test(token)) {
    throw new AuthenticationError('INVALID_TOKEN')
  }
  return { Authorization: `Bearer ${token}` }
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ApiError(`Invalid ${field}`, 'API_ERROR', 500, { field, value })
  }
  return value
}

function parseCapabilities(payload: unknown): BacktestCapabilities {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('Invalid capabilities payload', 'API_ERROR', 500, { payload })
  }

  const candidate = payload as Record<string, unknown>
  const allowedBaseTimeframes = parseStringArray(candidate.allowedBaseTimeframes, 'allowedBaseTimeframes')

  if (allowedBaseTimeframes.length === 0) {
    throw new ApiError('Backtest capability unavailable', 'CAPABILITY_UNAVAILABLE', 503, {
      allowedBaseTimeframes,
    })
  }

  return { allowedBaseTimeframes }
}

function normalizeJobId(jobId: string): string {
  const trimmed = jobId.trim()
  if (!trimmed) {
    throw new ApiError('jobId is required', 'VALIDATION_ERROR', 400, { jobId })
  }
  return encodeURIComponent(trimmed)
}

function assertBacktestJobPhase(status: unknown, context: string): asserts status is BacktestJobPhase {
  if (typeof status === 'string' && VALID_BACKTEST_JOB_PHASES.has(status as BacktestJobPhase)) {
    return
  }
  throw new ApiError(`Unexpected backtest job status: ${String(status)}`, 'API_ERROR', 500, {
    context,
    status,
  })
}

function parseBacktestJob(payload: unknown, context: string): BacktestJob {
  const job = payload as BacktestJob
  assertBacktestJobPhase(job?.status, context)
  return job
}

function readRangeBoundary(value: unknown): { fromTs: number; toTs: number } | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as { fromTs?: unknown; toTs?: unknown }
  if (typeof candidate.fromTs !== 'number' || typeof candidate.toTs !== 'number') {
    return null
  }

  return {
    fromTs: candidate.fromTs,
    toTs: candidate.toTs,
  }
}

function formatRangeBoundary(value: { fromTs: number; toTs: number }): string {
  return `${new Date(value.fromTs).toISOString()} ~ ${new Date(value.toTs).toISOString()}`
}

async function requestJson<T>(
  operation: (signal: AbortSignal) => Promise<unknown>,
  timeoutMs: number,
  upstreamSignal?: AbortSignal,
): Promise<T> {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)
  const signal = upstreamSignal ? AbortSignal.any([timeoutController.signal, upstreamSignal]) : timeoutController.signal

  try {
    const response = await operation(signal)
    return unwrapApiResponse(response as T | { data?: T; message?: string }) as T
  } catch (error) {
    if (timedOut) {
      throw new ApiError('Request timeout', 'API_TIMEOUT', 408, {
        timeoutMs,
      })
    }
    if (error instanceof ApiError) {
      throw error
    }
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object'
    ) {
      const response = error.response as { status?: number; statusText?: string; data?: unknown }
      const payload = response.data
      const message = buildAiQuantErrorMessage(
        response.statusText || 'Request failed',
        response.status ?? 500,
        parseAiQuantErrorMeta(payload),
      )
      throw new ApiError(message, extractErrorCode(payload), response.status, payload)
    }
    const message = error instanceof Error && error.message.trim() ? error.message : 'Request failed'
    throw new ApiError(message, 'API_ERROR')
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function buildBacktestingHeaders(path: string): Record<string, string> {
  return {
    ...requireAuthHeaders(),
    'x-request-id': `front-backtest:${path}:${Date.now()}`,
  }
}

export async function fetchBacktestCapabilities(
  options?: FetchBacktestCapabilitiesOptions,
): Promise<BacktestCapabilities> {
  let lastError: unknown
  const headers = buildBacktestingHeaders('capabilities')

  for (let attempt = 1; attempt <= BACKTEST_CAPABILITY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const payload = await requestJson<BacktestCapabilities>(
        signal =>
          (client as any).BacktestingProxyController_capabilities({
            headers,
            signal,
          }),
        BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
        options?.signal,
      )
      return parseCapabilities(payload)
    } catch (error) {
      lastError = error
      if (!(error instanceof ApiError)) {
        throw error
      }
      if (options?.signal?.aborted) {
        throw error
      }

      const isTransientUpstream =
        error.statusCode === 502 || error.statusCode === 503 || error.code === 'API_ERROR'
      const isLastAttempt = attempt >= BACKTEST_CAPABILITY_RETRY_ATTEMPTS
      if (!isTransientUpstream || isLastAttempt) {
        throw error
      }

      await waitRetryDelay(options?.signal)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError('Failed to fetch backtest capabilities', 'API_ERROR')
}

export async function postBacktestSymbolSupportCheck(
  input: BacktestSymbolSupportCheckInput,
): Promise<BacktestSymbolSupportCheckPayload> {
  const headers = buildBacktestingHeaders('symbol-check')
  return requestJson<BacktestSymbolSupportCheckPayload>(
    async signal => {
      const response = await fetch(`${API_BASE_URL}/backtesting/symbols/check`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(input),
      })
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        const message = buildAiQuantErrorMessage(
          response.statusText || 'Request failed',
          response.status,
          parseAiQuantErrorMeta(payload),
        )
        throw new ApiError(message, extractErrorCode(payload), response.status, payload)
      }

      return payload
    },
    BACKTEST_REQUEST_TIMEOUT_MS,
  )
}

export async function createBacktestJob(payload: CreateBacktestJobPayload): Promise<BacktestJob> {
  const headers = buildBacktestingHeaders('create-job')
  const job = await requestJson<BacktestJob>(
    signal =>
      (client as any).BacktestingProxyController_createJob(payload, {
        headers,
        signal,
      }),
    BACKTEST_REQUEST_TIMEOUT_MS,
  )
  return parseBacktestJob(job, 'createBacktestJob')
}

export async function getBacktestJob(jobId: string): Promise<BacktestJob> {
  const safeJobId = normalizeJobId(jobId)
  const headers = buildBacktestingHeaders(`job:${safeJobId}`)
  const job = await requestJson<BacktestJob>(
    signal =>
      (client as any).BacktestingProxyController_getJob({
        headers,
        params: { id: safeJobId },
        signal,
      }),
    BACKTEST_REQUEST_TIMEOUT_MS,
  )
  return parseBacktestJob(job, 'getBacktestJob')
}

export function getBacktestJobResult(jobId: string): Promise<BacktestJobResult> {
  const safeJobId = normalizeJobId(jobId)
  const headers = buildBacktestingHeaders(`job-result:${safeJobId}`)
  return requestJson<BacktestJobResult>(
    signal =>
      (client as any).BacktestingProxyController_getJobResult({
        headers,
        params: { id: safeJobId },
        signal,
      }),
    BACKTEST_REQUEST_TIMEOUT_MS,
  )
}

export function formatBacktestJobFailure(job: Pick<BacktestJob, 'error' | 'errorDetails'>): string {
  const details = job.errorDetails
  if (details?.code === 'backtest.data_range_out_of_coverage') {
    const suggestedRange = readRangeBoundary(details.args?.suggestedRange)
    const availableRange = readRangeBoundary(details.args?.availableRange)

    if (suggestedRange) {
      return `当前选择的回测时间范围没有完整市场数据覆盖，建议改为 ${formatRangeBoundary(suggestedRange)} 后重试。`
    }

    if (availableRange) {
      return `当前选择的回测时间范围没有完整市场数据覆盖，当前完整可用范围为 ${formatRangeBoundary(availableRange)}。`
    }

    return '当前选择的回测时间范围没有完整市场数据覆盖，请把结束时间往前调整一点后再试。'
  }

  return details?.message?.trim() || job.error?.trim() || '回测任务执行失败'
}
