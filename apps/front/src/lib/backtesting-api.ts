import { API_BASE_URL, unwrapApiResponse } from '@/lib/api-client'
import { getToken } from '@/lib/auth-storage'
import { ApiError, AuthenticationError } from '@/lib/errors'
import { parseAiQuantErrorMeta } from '@/components/ai-quant/ai-quant-error-stage'

export interface BacktestCapabilities {
  allowedSymbols: string[]
  allowedBaseTimeframes: string[]
}

export interface FetchBacktestCapabilitiesOptions {
  signal?: AbortSignal
}

export type BacktestJobPhase = 'queued' | 'running' | 'succeeded' | 'failed'

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
  resultSummary?: BacktestJobResult['summary']
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

    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, BACKTEST_CAPABILITY_RETRY_DELAY_MS)

    const onAbort = () => {
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new ApiError('Request aborted', 'API_ERROR'))
    }

    signal?.addEventListener('abort', onAbort)
  })
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  const meta = parseAiQuantErrorMeta(payload)
  return meta.message ?? fallback
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
  const allowedSymbols = parseStringArray(candidate.allowedSymbols, 'allowedSymbols')
  const allowedBaseTimeframes = parseStringArray(candidate.allowedBaseTimeframes, 'allowedBaseTimeframes')

  if (allowedSymbols.length === 0 || allowedBaseTimeframes.length === 0) {
    throw new ApiError('Backtest capability unavailable', 'CAPABILITY_UNAVAILABLE', 503, {
      allowedSymbols,
      allowedBaseTimeframes,
    })
  }

  return { allowedSymbols, allowedBaseTimeframes }
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

async function requestJson<T>(
  path: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<T> {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)

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
      cache: 'no-store',
      signal: timeoutController.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new ApiError('Request timeout', 'API_TIMEOUT', 408, {
        path,
        timeoutMs,
      })
    }
    if (error instanceof ApiError) {
      throw error
    }
    const message = error instanceof Error && error.message.trim() ? error.message : 'Request failed'
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

export async function fetchBacktestCapabilities(
  options?: FetchBacktestCapabilitiesOptions,
): Promise<BacktestCapabilities> {
  let lastError: unknown

  for (let attempt = 1; attempt <= BACKTEST_CAPABILITY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const payload = await requestJson<BacktestCapabilities>(
        '/backtesting/capabilities',
        BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
        {
          method: 'GET',
          signal: options?.signal,
        },
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

export async function createBacktestJob(payload: CreateBacktestJobPayload): Promise<BacktestJob> {
  const job = await requestJson<BacktestJob>('/backtesting/jobs', BACKTEST_REQUEST_TIMEOUT_MS, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseBacktestJob(job, 'createBacktestJob')
}

export async function getBacktestJob(jobId: string): Promise<BacktestJob> {
  const safeJobId = normalizeJobId(jobId)
  const job = await requestJson<BacktestJob>(`/backtesting/jobs/${safeJobId}`, BACKTEST_REQUEST_TIMEOUT_MS, {
    method: 'GET',
  })
  return parseBacktestJob(job, 'getBacktestJob')
}

export function getBacktestJobResult(jobId: string): Promise<BacktestJobResult> {
  const safeJobId = normalizeJobId(jobId)
  return requestJson<BacktestJobResult>(
    `/backtesting/jobs/${safeJobId}/result`,
    BACKTEST_REQUEST_TIMEOUT_MS,
    {
      method: 'GET',
    },
  )
}
