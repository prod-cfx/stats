import { API_BASE_URL, unwrapApiResponse } from '@/lib/api-client'
import { getToken } from '@/lib/auth-storage'
import { ApiError, AuthenticationError } from '@/lib/errors'

interface ErrorPayload {
  code?: unknown
  message?: unknown
  error?: {
    code?: unknown
    message?: unknown
  }
}

export interface BacktestCapabilities {
  allowedSymbols: string[]
  allowedBaseTimeframes: string[]
}

export interface FetchBacktestCapabilitiesOptions {
  signal?: AbortSignal
}

const JWT_FORMAT_REGEX = /^[\w-]+\.[\w-]+\.[\w-]+$/
export const BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS = 12_000

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as ErrorPayload
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS)

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
      throw new ApiError('Request timeout', 'API_TIMEOUT', 408, {
        path,
        timeoutMs: BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
      })
    }
    if (upstreamSignal?.aborted) {
      throw new ApiError('Request aborted', 'API_ABORTED', 499, { path })
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
  const payload = await requestJson<BacktestCapabilities>('/backtesting/capabilities', {
    method: 'GET',
    signal: options?.signal,
  })
  return parseCapabilities(payload)
}
