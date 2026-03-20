import type { AccountExchangeAccountResponseDto } from '../dto/account-exchange-account.response.dto'
import type { CreateAccountExchangeAccountDto } from '../dto/create-account-exchange-account.dto'
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
    userId: string,
    dto: CreateAccountExchangeAccountDto,
  ): Promise<AccountExchangeAccountResponseDto> {
    return this.request<AccountExchangeAccountResponseDto>('/exchange-accounts', {
      method: 'POST',
      body: JSON.stringify({
        userId,
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
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    if (response.status === 204) {
      return undefined as T
    }

    const payload = await response.json() as T | { data?: T } | QuantifyErrorPayload

    if (!response.ok) {
      const errorPayload = payload as QuantifyErrorPayload
      throw new QuantifyClientError(
        errorPayload.message || 'Quantify request failed',
        errorPayload.status || response.status,
        errorPayload.error?.code,
        errorPayload.error?.args,
      )
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data: T }).data
    }

    return payload as T
  }

  private baseUrl(): string {
    return this.env.getString('QUANTIFY_API_BASE_URL')
      || this.env.getString('QUANTIFY_BASE_URL')
      || 'http://localhost:3010/api/v1'
  }
}
