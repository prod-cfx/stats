import type { AccountExchangeAccountResponseDto } from './dto/account-exchange-account.response.dto'
import type { CreateAccountExchangeAccountDto } from './dto/create-account-exchange-account.dto'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { QuantifyClientError, QuantifyExchangeAccountsClient } from './clients/quantify-exchange-accounts.client'

@Injectable()
export class AccountExchangeAccountsService {
  private static readonly TRANSIENT_UPSTREAM_CODES = new Set([
    'UPSTREAM_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
  ])
  private readonly logger = new Logger(AccountExchangeAccountsService.name)

  constructor(
    @Inject(QuantifyExchangeAccountsClient)
    private readonly quantifyClient: QuantifyExchangeAccountsClient,
  ) {}

  async list(
    userId: string,
    options?: { degradeOnTransientFailure?: boolean },
  ): Promise<AccountExchangeAccountResponseDto[]> {
    try {
      return await this.quantifyClient.list(userId)
    }
    catch (error) {
      if (options?.degradeOnTransientFailure && this.isTransientUpstreamFailure(error)) {
        this.logger.warn(`event=exchange_accounts_list_fallback reason=${this.describeError(error)} userId=${userId}`)
        return []
      }
      throw this.mapQuantifyError(error)
    }
  }

  async upsert(
    user: AuthenticatedUser,
    dto: CreateAccountExchangeAccountDto,
  ): Promise<AccountExchangeAccountResponseDto> {
    try {
      return await this.quantifyClient.upsert(user, dto)
    }
    catch (error) {
      throw this.mapQuantifyError(error)
    }
  }

  async delete(userId: string, exchangeId: string): Promise<void> {
    try {
      await this.quantifyClient.delete(userId, exchangeId)
    }
    catch (error) {
      throw this.mapQuantifyError(error)
    }
  }

  private mapQuantifyError(error: unknown): DomainException {
    if (this.isTransientUpstreamFailure(error)) {
      return this.buildTransientUnavailableException(error)
    }

    if (error instanceof QuantifyClientError) {
      return this.toDomainException(error.status, error.code, error.args, error.message)
    }

    if (this.isQuantifyErrorShape(error)) {
      return this.toDomainException(
        error.status,
        error.code,
        error.args,
        error.message,
      )
    }

    if (error instanceof DomainException) {
      return error
    }

    return new DomainException('Quantify request failed', {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  }

  private buildTransientUnavailableException(error: unknown): DomainException {
    return new DomainException('量化服务暂时不可用，请稍后重试', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: {
        reasonMessage: '量化服务暂时不可用，请稍后重试',
        retryable: true,
        upstreamCode: this.getQuantifyErrorCode(error),
      },
    })
  }

  private toDomainException(
    status: number,
    code: string | undefined,
    args: Record<string, unknown> | undefined,
    fallbackMessage: string,
  ): DomainException {
    return new DomainException(
      typeof args?.reasonMessage === 'string' ? args.reasonMessage : fallbackMessage,
      {
        code: (code as ErrorCode | undefined) ?? ErrorCode.BAD_REQUEST,
        args,
        status,
      },
    )
  }

  private isQuantifyErrorShape(error: unknown): error is {
    status: number
    code?: string
    args?: Record<string, unknown>
    message: string
  } {
    return typeof error === 'object'
      && error !== null
      && 'status' in error
      && typeof (error as { status?: unknown }).status === 'number'
      && 'message' in error
      && typeof (error as { message?: unknown }).message === 'string'
  }

  private isTransientUpstreamFailure(error: unknown): boolean {
    const code = this.getQuantifyErrorCode(error)
    return typeof code === 'string' && AccountExchangeAccountsService.TRANSIENT_UPSTREAM_CODES.has(code)
  }

  private getQuantifyErrorCode(error: unknown): string | undefined {
    if (error instanceof QuantifyClientError) return error.code
    if (this.isQuantifyErrorShape(error)) return error.code
    return undefined
  }

  private describeError(error: unknown): string {
    if (error instanceof QuantifyClientError) {
      return `${error.status}:${error.code ?? 'UNKNOWN'}:${error.message}`
    }
    if (this.isQuantifyErrorShape(error)) {
      return `${error.status}:${error.code ?? 'UNKNOWN'}:${error.message}`
    }
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}
