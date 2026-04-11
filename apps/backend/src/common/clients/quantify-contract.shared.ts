import { createQuantifyApiClient } from '@ai/api-contracts'
import { unwrapTransportResponse } from '@ai/shared'
import { normalizeAppEnv } from '@/common/env/env.accessor'
import { EnvService } from '@/common/services/env.service'

interface QuantifyErrorPayload {
  status?: number
  error?: {
    code?: string
    args?: Record<string, unknown>
  }
  message?: string
}

interface AxiosLikeError {
  isAxiosError: true
  message?: string
  response?: {
    status: number
    data: unknown
  }
}

const ENV_PLACEHOLDER = '__SET_IN_env.local__'
const INTERNAL_QUANTIFY_API_BASE_URL = 'http://127.0.0.1:3010/api/v1'
const STAGING_PUBLIC_QUANTIFY_HOSTS = new Set([
  'cfx-quantify-staging.devbase.cloud',
  'cfx-quantify-stg.devbase.cloud',
])

export interface QuantifyRequestOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

export interface QuantifyAbortContext {
  signal: AbortSignal
  cleanup: () => void
  getAbortReason: () => unknown
}

export type QuantifyApiClient = ReturnType<typeof createQuantifyApiClient>

export class QuantifyClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly args?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'QuantifyClientError'
  }
}

function normalizeQuantifyBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  try {
    const parsed = new URL(trimmed)
    const normalizedPath = parsed.pathname.replace(/\/+$/, '')
    if (/\/api\/v\d+$/i.test(normalizedPath)) {
      return trimmed
    }
    if (normalizedPath === '' || normalizedPath === '/') {
      return `${trimmed}/api/v1`
    }
    return trimmed
  } catch {
    if (/\/api\/v\d+$/i.test(trimmed)) {
      return trimmed
    }
    if (!trimmed.includes('/')) {
      return `${trimmed}/api/v1`
    }
    return trimmed
  }
}

function normalizeConfiguredUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  if (!normalized || normalized === ENV_PLACEHOLDER) {
    return undefined
  }
  return normalized
}

function shouldBypassPublicQuantifyGateway(appEnv: string | undefined, configuredUrl: string | undefined): boolean {
  if (!configuredUrl) return false
  if (normalizeAppEnv(appEnv) !== 'staging') return false
  try {
    return STAGING_PUBLIC_QUANTIFY_HOSTS.has(new URL(configuredUrl).hostname)
  } catch {
    return false
  }
}

export function resolveQuantifyBaseUrl(env: EnvService): string {
  const explicitApiBase = normalizeConfiguredUrl(env.getString('QUANTIFY_API_BASE_URL'))
  if (shouldBypassPublicQuantifyGateway(env.getString('APP_ENV'), explicitApiBase)) {
    return INTERNAL_QUANTIFY_API_BASE_URL
  }
  if (explicitApiBase) {
    return normalizeQuantifyBaseUrl(explicitApiBase)
  }

  const base = normalizeConfiguredUrl(env.getString('QUANTIFY_BASE_URL'))
  if (shouldBypassPublicQuantifyGateway(env.getString('APP_ENV'), base)) {
    return INTERNAL_QUANTIFY_API_BASE_URL
  }
  if (base) {
    return normalizeQuantifyBaseUrl(base)
  }

  return 'http://localhost:3010/api/v1'
}

export function createBackendQuantifyApiClient(env: EnvService): QuantifyApiClient {
  return createQuantifyApiClient(resolveQuantifyBaseUrl(env), { validate: 'all' })
}

export function createQuantifyAbortContext(timeoutMs: number | undefined, upstreamSignal?: AbortSignal): QuantifyAbortContext | undefined {
  if (!timeoutMs && !upstreamSignal) {
    return undefined
  }

  const controller = new AbortController()
  const onUpstreamAbort = () => controller.abort(upstreamSignal?.reason)

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort(upstreamSignal.reason)
    } else {
      upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true })
    }
  }

  const timeout = timeoutMs === undefined
    ? undefined
    : setTimeout(() => controller.abort(`timeout after ${timeoutMs}ms`), timeoutMs)

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeout) clearTimeout(timeout)
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', onUpstreamAbort)
      }
    },
    getAbortReason: () => controller.signal.reason,
  }
}

export async function runQuantifyContractRequest<T>(
  request: () => Promise<unknown>,
  getAbortReason?: () => unknown,
): Promise<T> {
  try {
    const payload = await request()
    return unwrapQuantifyResponse<T>(payload)
  } catch (error) {
    throw mapQuantifyContractError(error, getAbortReason?.())
  }
}

function unwrapQuantifyResponse<T>(payload: unknown): T {
  if (payload === undefined || payload === '') {
    return undefined as T
  }

  if (typeof payload === 'string') {
    throw new QuantifyClientError(
      'Quantify returned a non-JSON success response',
      502,
      'UPSTREAM_INVALID_RESPONSE',
      { upstreamBody: payload.slice(0, 500) },
    )
  }

  return unwrapTransportResponse(payload as T | { data?: T })
}

function mapQuantifyContractError(error: unknown, abortedReason?: unknown): QuantifyClientError {
  if (error instanceof QuantifyClientError) {
    return error
  }

  if (isAxiosLikeError(error)) {
    if (error.response) {
      return mapQuantifyAxiosResponseError(error.response.status, error.response.data)
    }

    return new QuantifyClientError(
      'Quantify request failed',
      502,
      'UPSTREAM_REQUEST_FAILED',
      {
        cause: stringifyCause(abortedReason ?? error.message),
      },
    )
  }

  return new QuantifyClientError(
    'Quantify request failed',
    502,
    'UPSTREAM_REQUEST_FAILED',
    {
      cause: stringifyCause(abortedReason ?? error),
    },
  )
}

function isAxiosLikeError(error: unknown): error is AxiosLikeError {
  return typeof error === 'object'
    && error !== null
    && 'isAxiosError' in error
    && (error as { isAxiosError?: unknown }).isAxiosError === true
}

function mapQuantifyAxiosResponseError(status: number, payload: unknown): QuantifyClientError {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return new QuantifyClientError(
      'Quantify returned a non-JSON error response',
      status,
      'UPSTREAM_INVALID_RESPONSE',
      {
        upstreamBody: typeof payload === 'string' ? payload.slice(0, 500) : JSON.stringify(payload).slice(0, 500),
      },
    )
  }

  const errorPayload = payload as QuantifyErrorPayload
  return new QuantifyClientError(
    errorPayload.message || 'Quantify request failed',
    errorPayload.status || status,
    errorPayload.error?.code,
    errorPayload.error?.args,
  )
}

function stringifyCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return String(cause)
}
