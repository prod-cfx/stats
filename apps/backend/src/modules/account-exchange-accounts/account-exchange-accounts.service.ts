import type { AccountExchangeAccountResponseDto } from './dto/account-exchange-account.response.dto'
import type { CreateAccountExchangeAccountDto } from './dto/create-account-exchange-account.dto'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { QuantifyClientError, QuantifyExchangeAccountsClient } from './clients/quantify-exchange-accounts.client'

@Injectable()
export class AccountExchangeAccountsService {
  constructor(
    @Inject(QuantifyExchangeAccountsClient)
    private readonly quantifyClient: QuantifyExchangeAccountsClient,
  ) {}

  async list(userId: string): Promise<AccountExchangeAccountResponseDto[]> {
    return this.quantifyClient.list(userId)
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
}
