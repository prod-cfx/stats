import type { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import type {
  AccountAiQuantStrategyDeployResultResponseDto,
  AccountAiQuantStrategyDetailResponseDto,
  AccountAiQuantStrategyListItemResponseDto,
} from './dto/account-ai-quant-strategy.response.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AccountExchangeAccountsService } from '@/modules/account-exchange-accounts/account-exchange-accounts.service'
import { AiQuantProxySupportService } from './ai-quant-proxy-support.service'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'

@Injectable()
export class AccountAiQuantStrategiesProxyService {
  private static readonly DEPLOY_RETRY_ATTEMPTS = 3
  private static readonly DEPLOY_BACKOFF_BASE_MS = 200
  private static readonly DEPLOY_BACKOFF_MAX_MS = 1_000
  private static readonly DEPLOY_BACKOFF_JITTER_MS = 80

  private readonly logger = new Logger(AccountAiQuantStrategiesProxyService.name)

  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
    @Inject(AccountExchangeAccountsService)
    private readonly exchangeAccountsService: AccountExchangeAccountsService,
    @Inject(AiQuantProxySupportService)
    private readonly support: AiQuantProxySupportService,
  ) {}

  async listAccountStrategies(
    userId: string,
    authorization: string | undefined,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<BasePaginationResponseDto<AccountAiQuantStrategyListItemResponseDto>> {
    return this.quantifyClient.listAccountStrategies<BasePaginationResponseDto<AccountAiQuantStrategyListItemResponseDto>>(query, {
      userId,
      headers: this.support.userHeaders(userId, authorization),
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async getAccountStrategyDetail(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.quantifyClient.getAccountStrategyDetail<AccountAiQuantStrategyDetailResponseDto>(strategyId, {
      userId,
      headers: this.support.userHeaders(userId, authorization),
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async getDeployResult(
    userId: string,
    authorization: string | undefined,
    deployRequestId: string,
  ): Promise<AccountAiQuantStrategyDeployResultResponseDto> {
    return this.quantifyClient.getDeployResult<AccountAiQuantStrategyDeployResultResponseDto>(deployRequestId, {
      userId,
      headers: this.support.userHeaders(userId, authorization),
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async performAccountStrategyAction(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.quantifyClient.performAccountStrategyAction<AccountAiQuantStrategyDetailResponseDto>(
      strategyId,
      { ...body, userId },
      { userId, headers: this.support.userHeaders(userId, authorization) },
    ).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async deployAccountStrategy(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    await this.assertExchangeAccountExists(userId, body.exchangeAccountId)

    const payload: Record<string, unknown> = {
      userId,
      name: body.name,
      deployRequestId: body.deployRequestId,
      publishedSnapshotId: body.publishedSnapshotId,
    }
    if (body.exchangeAccountId !== undefined) payload.exchangeAccountId = body.exchangeAccountId
    if (body.exchangeAccountName !== undefined) payload.exchangeAccountName = body.exchangeAccountName
    if (body.deploymentExecutionConfig !== undefined) {
      payload.deploymentExecutionConfig = body.deploymentExecutionConfig
    }

    for (let attempt = 1; attempt <= AccountAiQuantStrategiesProxyService.DEPLOY_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.deployAccountStrategy<AccountAiQuantStrategyDetailResponseDto>(
          payload,
          { userId, headers: this.support.userHeaders(userId, authorization) },
        )
      } catch (error) {
        const isTransientUpstreamFailure = this.support.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AccountAiQuantStrategiesProxyService.DEPLOY_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          if (isTransientUpstreamFailure) {
            const reconciledResult = await this.tryReconcileTransientDeployResult(
              userId,
              authorization,
              body.deployRequestId,
            )
            if (reconciledResult) {
              this.logger.warn(
                `event=deploy_reconciled_after_transient_failure deployRequestId=${String(body.deployRequestId ?? '')} reason=${this.support.describeError(error)}`,
              )
              return reconciledResult as unknown as AccountAiQuantStrategyDetailResponseDto
            }
          }
          throw this.support.mapQuantifyError(error)
        }
        this.logger.warn(`event=deploy_retry reason=${this.support.describeError(error)} attempt=${attempt}`)
        await this.sleep(this.getDeployBackoffMs(attempt))
      }
    }

    throw new DomainException('Quantify request failed', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
  }

  async updateAccountStrategyExecutionLeverage(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.quantifyClient.updateAccountStrategyExecutionLeverage<AccountAiQuantStrategyDetailResponseDto>(
      strategyId,
      { userId, leverage: body.leverage },
      { userId, headers: this.support.userHeaders(userId, authorization) },
    ).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async deleteAccountStrategy(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    options: { deleteStoppedStrategy?: boolean } = {},
  ): Promise<void> {
    await this.quantifyClient.deleteAccountStrategy(strategyId, {
      userId,
      headers: this.support.userHeaders(userId, authorization),
      deleteStoppedStrategy: options.deleteStoppedStrategy === true,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  private async assertExchangeAccountExists(userId: string, exchangeAccountId: unknown): Promise<void> {
    if (typeof exchangeAccountId !== 'string' || exchangeAccountId.trim().length === 0) return

    const accounts = await this.exchangeAccountsService.list(userId)
    const exists = accounts.some(account => account.id === exchangeAccountId)
    if (exists) return

    throw new DomainException('exchange account not found', {
      code: ErrorCode.EXCHANGE_ACCOUNT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args: {
        accountId: exchangeAccountId,
        reasonMessage: 'exchange account not found',
      },
    })
  }

  private async tryReconcileTransientDeployResult(
    userId: string,
    authorization: string | undefined,
    deployRequestId: unknown,
  ): Promise<AccountAiQuantStrategyDeployResultResponseDto | null> {
    if (typeof deployRequestId !== 'string' || deployRequestId.trim().length === 0) {
      return null
    }

    try {
      return await this.quantifyClient.getDeployResult<AccountAiQuantStrategyDeployResultResponseDto>(deployRequestId.trim(), {
        userId,
        headers: this.support.userHeaders(userId, authorization),
      })
    } catch (error) {
      this.logger.warn(
        `event=deploy_reconciliation_failed deployRequestId=${deployRequestId.trim()} reason=${this.support.describeError(error)}`,
      )
      return null
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getDeployBackoffMs(attempt: number): number {
    const expo = Math.min(
      AccountAiQuantStrategiesProxyService.DEPLOY_BACKOFF_BASE_MS * 2 ** (attempt - 1),
      AccountAiQuantStrategiesProxyService.DEPLOY_BACKOFF_MAX_MS,
    )
    const jitter = Math.floor(Math.random() * AccountAiQuantStrategiesProxyService.DEPLOY_BACKOFF_JITTER_MS)
    return expo + jitter
  }
}
