import type { AiQuantConversationResponseDto } from './dto/ai-quant-conversation.response.dto'
import type { CodegenSessionResponseDto } from './dto/codegen-session.response.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AccountExchangeAccountsService } from '@/modules/account-exchange-accounts/account-exchange-accounts.service'
import { QuantifyAiQuantClient, QuantifyClientError } from './clients/quantify-ai-quant.client'

@Injectable()
export class AiQuantProxyService {
  private static readonly BACKTEST_CAPABILITIES_RETRY_ATTEMPTS = 3
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_BASE_MS = 200
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_MAX_MS = 1_500
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_JITTER_MS = 100
  private static readonly CODEGEN_REQUEST_TIMEOUT_MS = 60_000
  private static readonly DEPLOY_RETRY_ATTEMPTS = 3
  private static readonly DEPLOY_BACKOFF_BASE_MS = 200
  private static readonly DEPLOY_BACKOFF_MAX_MS = 1_000
  private static readonly DEPLOY_BACKOFF_JITTER_MS = 80
  private static readonly TRANSIENT_UPSTREAM_CODES = new Set([
    'UPSTREAM_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
  ])
  private readonly logger = new Logger(AiQuantProxyService.name)

  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
    @Inject(AccountExchangeAccountsService)
    private readonly exchangeAccountsService: AccountExchangeAccountsService,
  ) {}

  async listAccountStrategies(
    userId: string,
    authorization: string | undefined,
    query: Record<string, string | number | boolean | undefined>,
  ) {
    return this.quantifyClient.listAccountStrategies(query, {
      userId,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getAccountStrategyDetail(userId: string, authorization: string | undefined, strategyId: string) {
    return this.quantifyClient.getAccountStrategyDetail(strategyId, {
      userId,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async performAccountStrategyAction(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ) {
    return this.quantifyClient.performAccountStrategyAction(
      strategyId,
      { ...body, userId },
      { userId, headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async deployAccountStrategy(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
  ) {
    await this.assertExchangeAccountExists(userId, body.exchangeAccountId)

    const payload: Record<string, unknown> = {
      userId,
      name: body.name,
      deployRequestId: body.deployRequestId,
      publishedSnapshotId: body.publishedSnapshotId,
    }
    if (body.strategyInstanceId !== undefined) payload.strategyInstanceId = body.strategyInstanceId
    if (body.exchangeAccountId !== undefined) payload.exchangeAccountId = body.exchangeAccountId
    if (body.exchangeAccountName !== undefined) payload.exchangeAccountName = body.exchangeAccountName
    if (body.leverage !== undefined) payload.leverage = body.leverage

    for (let attempt = 1; attempt <= AiQuantProxyService.DEPLOY_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.deployAccountStrategy(
          payload,
          { userId, headers: this.userHeaders(userId, authorization) },
        )
      } catch (error) {
        const isTransientUpstreamFailure = this.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AiQuantProxyService.DEPLOY_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          throw this.mapQuantifyError(error)
        }
        this.logger.warn(`event=deploy_retry reason=${this.describeError(error)} attempt=${attempt}`)
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
  ) {
    return this.quantifyClient.updateAccountStrategyExecutionLeverage(
      strategyId,
      { userId, leverage: body.leverage },
      { userId, headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
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

  async deleteAccountStrategy(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
  ): Promise<void> {
    await this.quantifyClient.deleteAccountStrategy(strategyId, {
      userId,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async startCodegen(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
  ): Promise<CodegenSessionResponseDto> {
    return this.quantifyClient.startCodegen(body, {
      userId,
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listAiQuantConversations(userId: string, authorization: string | undefined): Promise<AiQuantConversationResponseDto[]> {
    return this.quantifyClient.get<AiQuantConversationResponseDto[]>('/account/ai-quant/conversations', {
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async deleteAiQuantConversation(userId: string, authorization: string | undefined, conversationId: string): Promise<void> {
    return this.quantifyClient.delete<void>(`/account/ai-quant/conversations/${encodeURIComponent(conversationId)}`, {
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getCodegenSession(
    userId: string,
    authorization: string | undefined,
    sessionId: string,
  ): Promise<CodegenSessionResponseDto> {
    return this.quantifyClient.getCodegenSession(sessionId, {
      userId,
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async continueCodegen(
    userId: string,
    authorization: string | undefined,
    sessionId: string,
    body: Record<string, unknown>,
  ): Promise<CodegenSessionResponseDto> {
    return this.quantifyClient.continueCodegen(sessionId, body, {
      userId,
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmInstances(userId: string | undefined, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.listLlmInstances({
      page: query.page,
      limit: query.limit,
      llmModel: query.llmModel,
      strategyId: query.strategyId,
      userId,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getLlmInstanceDetail(id: string, userId?: string) {
    return this.quantifyClient.getLlmInstanceDetail(id, userId).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmInstanceSignals(userId: string, id: string, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.listLlmInstanceSignals(id, {
      userId,
      page: query.page,
      limit: query.limit,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async createLlmSubscription(userId: string, body: Record<string, unknown>) {
    return this.quantifyClient.createLlmSubscription({
      ...body,
      userId,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmSubscriptions(userId: string, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.listLlmSubscriptions({
      userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getLlmSubscriptionDetail(userId: string, subscriptionId: string) {
    return this.quantifyClient.getLlmSubscriptionDetail(subscriptionId, userId).catch(error => { throw this.mapQuantifyError(error) })
  }

  async updateLlmSubscription(userId: string, subscriptionId: string, body: Record<string, unknown>) {
    return this.quantifyClient.updateLlmSubscription(subscriptionId, {
      ...body,
      userId,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async cancelLlmSubscription(userId: string, subscriptionId: string) {
    return this.quantifyClient.cancelLlmSubscription(subscriptionId, userId).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getBacktestCapabilities(authorization: string | undefined, requestId?: string) {
    let lastError: unknown

    for (let attempt = 1; attempt <= AiQuantProxyService.BACKTEST_CAPABILITIES_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.getBacktestCapabilities({
          headers: this.proxyHeaders(authorization, requestId),
        })
      } catch (error) {
        lastError = error
        const isTransientUpstreamFailure = this.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AiQuantProxyService.BACKTEST_CAPABILITIES_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          if (isTransientUpstreamFailure && isLastAttempt) {
            this.logger.warn(
              `event=backtesting_capabilities_retry_exhausted reason=${this.describeError(error)} requestId=${requestId ?? 'N/A'} attempt=${attempt}`,
            )
          }
          throw this.mapQuantifyError(error)
        }
        await this.sleep(this.getBacktestCapabilitiesBackoffMs(attempt))
      }
    }

    throw this.mapQuantifyError(lastError)
  }

  async createBacktestJob(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
    requestId?: string,
  ) {
    return this.quantifyClient.createBacktestJob(body, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async checkBacktestSymbolSupport(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
    requestId?: string,
  ) {
    return this.quantifyClient.checkBacktestSymbolSupport(body, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async getBacktestJob(userId: string, authorization: string | undefined, id: string, requestId?: string) {
    return this.quantifyClient.getBacktestJob(id, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async getBacktestJobResult(userId: string, authorization: string | undefined, id: string, requestId?: string) {
    return this.quantifyClient.getBacktestJobResult(id, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  private userHeaders(userId: string, authorization: string | undefined) {
    return {
      'x-user-id': userId,
      ...(authorization ? { authorization } : {}),
    }
  }

  private authorizationHeaders(authorization: string | undefined) {
    return authorization ? { authorization } : {}
  }

  private proxyHeaders(authorization: string | undefined, requestId?: string) {
    return {
      ...(authorization ? { authorization } : {}),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    }
  }

  private userProxyHeaders(userId: string, authorization: string | undefined, requestId?: string) {
    return {
      ...this.userHeaders(userId, authorization),
      ...(requestId ? { 'x-request-id': requestId } : {}),
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
      return this.toDomainException(error.status, error.code, error.args, error.message)
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

  private mapBacktestingJobError(error: unknown, requestId?: string): DomainException {
    if (this.isTransientUpstreamFailure(error)) {
      this.logger.warn(
        `event=backtesting_job_retryable_error reason=${this.describeError(error)} requestId=${requestId ?? 'N/A'}`,
      )
      return new DomainException('Backtesting upstream temporarily unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      })
    }
    return this.mapQuantifyError(error)
  }

  private isTransientUpstreamFailure(error: unknown): boolean {
    const code = this.getQuantifyErrorCode(error)
    return typeof code === 'string' && AiQuantProxyService.TRANSIENT_UPSTREAM_CODES.has(code)
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getBacktestCapabilitiesBackoffMs(attempt: number): number {
    const expo = Math.min(
      AiQuantProxyService.BACKTEST_CAPABILITIES_BACKOFF_BASE_MS * 2 ** (attempt - 1),
      AiQuantProxyService.BACKTEST_CAPABILITIES_BACKOFF_MAX_MS,
    )
    const jitter = Math.floor(Math.random() * AiQuantProxyService.BACKTEST_CAPABILITIES_BACKOFF_JITTER_MS)
    return expo + jitter
  }

  private getDeployBackoffMs(attempt: number): number {
    const expo = Math.min(
      AiQuantProxyService.DEPLOY_BACKOFF_BASE_MS * 2 ** (attempt - 1),
      AiQuantProxyService.DEPLOY_BACKOFF_MAX_MS,
    )
    const jitter = Math.floor(Math.random() * AiQuantProxyService.DEPLOY_BACKOFF_JITTER_MS)
    return expo + jitter
  }
}
