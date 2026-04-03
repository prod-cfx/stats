import { Inject, Injectable } from '@nestjs/common'
import { EnvService } from '@/common/services/env.service'

interface QuantifyErrorPayload {
  status?: number
  error?: {
    code?: string
    args?: Record<string, unknown>
  }
  message?: string
}

interface QuantifyRequestOptions extends RequestInit {
  timeoutMs?: number
}

const ENV_PLACEHOLDER = '__SET_IN_env.local__'

function tryParseJson<T>(raw: string): T | null {
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
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

@Injectable()
export class QuantifyAiQuantClient {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 10_000
  private static readonly MIN_REQUEST_TIMEOUT_MS = 1_000

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async get<T>(path: string, init?: QuantifyRequestOptions): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...init })
  }

  async post<T>(path: string, body?: unknown, init?: QuantifyRequestOptions): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    })
  }

  async patch<T>(path: string, body?: unknown, init?: QuantifyRequestOptions): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    })
  }

  async delete<T>(path: string, init?: QuantifyRequestOptions): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', ...init })
  }

  private async request<T>(path: string, init?: QuantifyRequestOptions): Promise<T> {
    const { timeoutMs: timeoutOverrideMs, ...fetchInit } = init ?? {}
    const timeoutMs = this.getRequestTimeoutMs(timeoutOverrideMs)
    const timeoutController = new AbortController()
    const upstreamSignal = fetchInit.signal
    const onUpstreamAbort = () => timeoutController.abort(upstreamSignal?.reason)
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        timeoutController.abort(upstreamSignal.reason)
      } else {
        upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true })
      }
    }
    const timeout = setTimeout(() => timeoutController.abort(`timeout after ${timeoutMs}ms`), timeoutMs)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        ...fetchInit,
        signal: timeoutController.signal,
        headers: {
          'content-type': 'application/json',
          ...(fetchInit.headers ?? {}),
        },
      })
    }
    catch (error) {
      throw new QuantifyClientError(
        'Quantify request failed',
        502,
        'UPSTREAM_REQUEST_FAILED',
        {
          cause: error instanceof Error ? error.message : String(error),
        },
      )
    }
    finally {
      clearTimeout(timeout)
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', onUpstreamAbort)
      }
    }

    if (response.status === 204) {
      return undefined as T
    }

    const rawPayload = await response.text()
    const payload = tryParseJson<T | { data?: T } | QuantifyErrorPayload>(rawPayload)

    if (!response.ok) {
      if (!payload) {
        throw new QuantifyClientError(
          'Quantify returned a non-JSON error response',
          response.status,
          'UPSTREAM_INVALID_RESPONSE',
          { upstreamBody: rawPayload.slice(0, 500) },
        )
      }

      const errorPayload = payload as QuantifyErrorPayload
      throw new QuantifyClientError(
        errorPayload.message || 'Quantify request failed',
        errorPayload.status || response.status,
        errorPayload.error?.code,
        errorPayload.error?.args,
      )
    }

    if (!payload) {
      throw new QuantifyClientError(
        'Quantify returned a non-JSON success response',
        502,
        'UPSTREAM_INVALID_RESPONSE',
        { upstreamBody: rawPayload.slice(0, 500) },
      )
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data: T }).data
    }

    return payload as T
  }

  private baseUrl(): string {
    const explicitApiBase = normalizeConfiguredUrl(this.env.getString('QUANTIFY_API_BASE_URL'))
    if (explicitApiBase) {
      return normalizeQuantifyBaseUrl(explicitApiBase)
    }

    const base = normalizeConfiguredUrl(this.env.getString('QUANTIFY_BASE_URL'))
    if (base) {
      return normalizeQuantifyBaseUrl(base)
    }

    return 'http://localhost:3010/api/v1'
  }

  private getRequestTimeoutMs(overrideMs?: number): number {
    if (overrideMs !== undefined && Number.isFinite(overrideMs)) {
      return Math.max(
        QuantifyAiQuantClient.MIN_REQUEST_TIMEOUT_MS,
        Math.floor(overrideMs),
      )
    }
    const configured = this.env.getNumber('QUANTIFY_REQUEST_TIMEOUT_MS')
    if (!configured || !Number.isFinite(configured)) {
      return QuantifyAiQuantClient.DEFAULT_REQUEST_TIMEOUT_MS
    }
    return Math.max(
      QuantifyAiQuantClient.MIN_REQUEST_TIMEOUT_MS,
      Math.floor(configured),
    )
  }
}
