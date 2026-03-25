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
  const trimmed = raw.trim().replace(/\/$/, '')
  if (/\/api\/v\d+$/i.test(trimmed)) {
    return trimmed
  }
  return `${trimmed}/api/v1`
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
  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...init })
  }

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    })
  }

  async patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    })
  }

  async delete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', ...init })
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers ?? {}),
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
    const explicitApiBase = this.env.getString('QUANTIFY_API_BASE_URL')
    if (explicitApiBase) {
      return normalizeQuantifyBaseUrl(explicitApiBase)
    }

    const base = this.env.getString('QUANTIFY_BASE_URL')
    if (base) {
      return normalizeQuantifyBaseUrl(base)
    }

    return 'http://localhost:3010/api/v1'
  }
}
