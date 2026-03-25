import { API_BASE_URL, unwrapApiResponse } from '@/lib/api-client'
import { getToken } from '@/lib/auth-storage'
import { ApiError, AuthenticationError } from '@/lib/errors'

export type BacktestJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface CreateBacktestJobPayload {
  symbols: string[]
  baseTimeframe: string
  stateTimeframes: string[]
  initialCash: number
  leverage: number
  execution: {
    slippageBps: number
    feeBps: number
    priceSource: 'open' | 'close' | 'mid'
  }
  strategy: {
    id: string
    protocolVersion: 'v1'
    scriptCode: string
    params: Record<string, unknown>
  }
  dataRange: {
    fromTs: number
    toTs: number
  }
  bars: unknown[]
}

export interface BacktestJob {
  id: string
  status: BacktestJobStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
}

export interface BacktestJobResult {
  summary: {
    netProfit: number
    netProfitPct: number
    maxDrawdownPct: number
    winRate: number
    profitFactor: number
    totalTrades: number
  }
}

interface ErrorPayload {
  code?: unknown
  message?: unknown
  error?: {
    code?: unknown
    message?: unknown
    args?: {
      reasonMessage?: unknown
    }
  }
}

const VALID_BACKTEST_JOB_STATUSES = new Set<BacktestJobStatus>([
  'queued',
  'running',
  'succeeded',
  'failed',
])
const JWT_FORMAT_REGEX = /^[\w-]+\.[\w-]+\.[\w-]+$/
export const BACKTEST_REQUEST_TIMEOUT_MS = 12_000

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as ErrorPayload
  if (typeof candidate.error?.args?.reasonMessage === 'string' && candidate.error.args.reasonMessage.trim()) {
    return candidate.error.args.reasonMessage
  }
  if (typeof candidate.error?.message === 'string' && candidate.error.message.trim()) {
    return candidate.error.message
  }
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
  }
  return fallback
}

function extractErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'API_ERROR'
  }

  const candidate = payload as ErrorPayload
  if (typeof candidate.error?.code === 'string' && candidate.error.code.trim()) {
    return candidate.error.code
  }
  if (typeof candidate.code === 'string' && candidate.code.trim()) {
    return candidate.code
  }
  return 'API_ERROR'
}

function normalizeJobId(jobId: string): string {
  const trimmed = jobId.trim()
  if (!trimmed) {
    throw new ApiError('jobId is required', 'VALIDATION_ERROR', 400, { jobId })
  }
  return encodeURIComponent(trimmed)
}

function assertBacktestJobStatus(status: unknown, context: string): asserts status is BacktestJobStatus {
  if (typeof status === 'string' && VALID_BACKTEST_JOB_STATUSES.has(status as BacktestJobStatus)) {
    return
  }
  throw new ApiError(
    `Unexpected backtest job status: ${String(status)}`,
    'API_ERROR',
    500,
    { context, status },
  )
}

function parseBacktestJob(payload: unknown, context: string): BacktestJob {
  const job = payload as BacktestJob
  assertBacktestJobStatus(job?.status, context)
  return job
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, BACKTEST_REQUEST_TIMEOUT_MS)

  const upstreamSignal = init?.signal
  const abortFromUpstream = () => timeoutController.abort()
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      timeoutController.abort()
    } else {
      upstreamSignal.addEventListener('abort', abortFromUpstream)
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...requireAuthHeaders(),
        ...(init?.headers ?? {}),
      },
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new ApiError('Request timeout', 'API_TIMEOUT', 408, { path, timeoutMs: BACKTEST_REQUEST_TIMEOUT_MS })
    }
    if (error instanceof ApiError) {
      throw error
    }
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : 'Request failed'
    throw new ApiError(message, 'API_ERROR')
  } finally {
    globalThis.clearTimeout(timeout)
    if (upstreamSignal) {
      upstreamSignal.removeEventListener('abort', abortFromUpstream)
    }
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload, response.statusText || 'Request failed')
    throw new ApiError(message, extractErrorCode(payload), response.status, payload)
  }

  return unwrapApiResponse(payload as T | { data?: T; message?: string }) as T
}

export async function createBacktestJob(payload: CreateBacktestJobPayload): Promise<BacktestJob> {
  const job = await requestJson<BacktestJob>('/backtesting/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseBacktestJob(job, 'createBacktestJob')
}

export async function getBacktestJob(jobId: string): Promise<BacktestJob> {
  const safeJobId = normalizeJobId(jobId)
  const job = await requestJson<BacktestJob>(`/backtesting/jobs/${safeJobId}`, {
    method: 'GET',
  })
  return parseBacktestJob(job, 'getBacktestJob')
}

export function getBacktestJobResult(jobId: string): Promise<BacktestJobResult> {
  const safeJobId = normalizeJobId(jobId)
  return requestJson<BacktestJobResult>(`/backtesting/jobs/${safeJobId}/result`, {
    method: 'GET',
  })
}
