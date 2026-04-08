import type { AccountExchangeAccountResponseDto } from '../dto/account-exchange-account.response.dto'
import type { CreateAccountExchangeAccountDto } from '../dto/create-account-exchange-account.dto'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Inject, Injectable } from '@nestjs/common'
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

const ENV_PLACEHOLDER = '__SET_IN_env.local__'
const INTERNAL_QUANTIFY_API_BASE_URL = 'http://127.0.0.1:3010/api/v1'
const STAGING_PUBLIC_QUANTIFY_HOSTS = new Set([
  'cfx-quantify-staging.devbase.cloud',
  'cfx-quantify-stg.devbase.cloud',
])

function tryParseJson<T>(raw: string): T | null {
  if (!raw.trim()) {
    return null
  }

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

function normalizeConfiguredUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  if (!normalized || normalized === ENV_PLACEHOLDER) {
    return undefined
  }
  return normalized
}

function shouldBypassPublicQuantifyGateway(appEnv: string | undefined, configuredUrl: string | undefined): boolean {
  if (!configuredUrl) {
    return false
  }
  if (normalizeAppEnv(appEnv) !== 'staging') {
    return false
  }
  try {
    return STAGING_PUBLIC_QUANTIFY_HOSTS.has(new URL(configuredUrl).hostname)
  } catch {
    return false
  }
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
export class QuantifyExchangeAccountsClient {
  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async list(userId: string): Promise<AccountExchangeAccountResponseDto[]> {
    return this.request<AccountExchangeAccountResponseDto[]>(`/exchange-accounts?userId=${encodeURIComponent(userId)}`)
  }

  async upsert(
    user: AuthenticatedUser,
    dto: CreateAccountExchangeAccountDto,
  ): Promise<AccountExchangeAccountResponseDto> {
    return this.request<AccountExchangeAccountResponseDto>('/exchange-accounts', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        userEmail: user.email,
        ...dto,
      }),
    })
  }

  async delete(userId: string, exchangeId: string): Promise<void> {
    await this.request<void>(`/exchange-accounts/${encodeURIComponent(exchangeId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
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
          {
            upstreamBody: rawPayload.slice(0, 500),
          },
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
        {
          upstreamBody: rawPayload.slice(0, 500),
        },
      )
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data: T }).data
    }

    return payload as T
  }

  private baseUrl(): string {
    const explicitApiBase = normalizeConfiguredUrl(this.env.getString('QUANTIFY_API_BASE_URL'))
    if (shouldBypassPublicQuantifyGateway(this.env.getString('APP_ENV'), explicitApiBase)) {
      return INTERNAL_QUANTIFY_API_BASE_URL
    }
    if (explicitApiBase) {
      return normalizeQuantifyBaseUrl(explicitApiBase)
    }

    const base = normalizeConfiguredUrl(this.env.getString('QUANTIFY_BASE_URL'))
    if (shouldBypassPublicQuantifyGateway(this.env.getString('APP_ENV'), base)) {
      return INTERNAL_QUANTIFY_API_BASE_URL
    }
    if (base) {
      return normalizeQuantifyBaseUrl(base)
    }

    return 'http://localhost:3010/api/v1'
  }
}
