import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { QuantifyAiQuantClient, QuantifyClientError } from './clients/quantify-ai-quant.client'

@Injectable()
export class AiQuantProxyService {
  private static readonly BACKTEST_CAPABILITIES_RETRY_ATTEMPTS = 3
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_BASE_MS = 200
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_MAX_MS = 1_500
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_JITTER_MS = 100
  private static readonly TRANSIENT_UPSTREAM_CODES = new Set([
    'UPSTREAM_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
  ])
  private readonly logger = new Logger(AiQuantProxyService.name)

  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
  ) {}

  async listAccountStrategies(
    userId: string,
    authorization: string | undefined,
    query: Record<string, string | number | boolean | undefined>,
  ) {
    return this.quantifyClient.get(this.buildPath('/account/ai-quant/strategies', {
      userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      subscribedOnly: query.subscribedOnly,
      excludeDraft: query.excludeDraft,
    }), { headers: this.userHeaders(userId, authorization) }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getAccountStrategyDetail(userId: string, authorization: string | undefined, strategyId: string) {
    return this.quantifyClient.get(
      this.buildPath(`/account/ai-quant/strategies/${encodeURIComponent(strategyId)}`, { userId }),
      { headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async performAccountStrategyAction(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ) {
    return this.quantifyClient.post(
      `/account/ai-quant/strategies/${encodeURIComponent(strategyId)}/actions`,
      { ...body, userId },
      { headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async deployAccountStrategy(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
  ) {
    return this.quantifyClient.post(
      '/account/ai-quant/strategies/deploy',
      { ...body, userId },
      { headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async deleteAccountStrategy(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
  ): Promise<void> {
    await this.quantifyClient.delete<void>(
      this.buildPath(`/account/ai-quant/strategies/${encodeURIComponent(strategyId)}`, { userId }),
      { headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async startCodegen(authorization: string | undefined, body: Record<string, unknown>) {
    return this.quantifyClient.post('/llm-strategy-codegen/sessions', body, {
      headers: this.authorizationHeaders(authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getCodegenSession(authorization: string | undefined, sessionId: string) {
    return this.quantifyClient.get(`/llm-strategy-codegen/sessions/${encodeURIComponent(sessionId)}`, {
      headers: this.authorizationHeaders(authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async continueCodegen(
    authorization: string | undefined,
    sessionId: string,
    body: Record<string, unknown>,
  ) {
    return this.quantifyClient.post(`/llm-strategy-codegen/sessions/${encodeURIComponent(sessionId)}/messages`, body, {
      headers: this.authorizationHeaders(authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmInstances(userId: string | undefined, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.get(this.buildPath('/llm-strategy-instances', {
      page: query.page,
      limit: query.limit,
      llmModel: query.llmModel,
      strategyId: query.strategyId,
      userId,
    })).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getLlmInstanceDetail(id: string, userId?: string) {
    return this.quantifyClient.get(
      this.buildPath(`/llm-strategy-instances/${encodeURIComponent(id)}`, { userId }),
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmInstanceSignals(userId: string, id: string, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.get(this.buildPath(`/llm-strategy-instances/${encodeURIComponent(id)}/signals`, {
      userId,
      page: query.page,
      limit: query.limit,
    })).catch(error => { throw this.mapQuantifyError(error) })
  }

  async createLlmSubscription(userId: string, body: Record<string, unknown>) {
    return this.quantifyClient.post('/llm-strategy-subscriptions', {
      ...body,
      userId,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async listLlmSubscriptions(userId: string, query: Record<string, string | number | undefined>) {
    return this.quantifyClient.get(this.buildPath('/llm-strategy-subscriptions', {
      userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    })).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getLlmSubscriptionDetail(userId: string, subscriptionId: string) {
    return this.quantifyClient.get(this.buildPath(`/llm-strategy-subscriptions/${encodeURIComponent(subscriptionId)}`, {
      userId,
    })).catch(error => { throw this.mapQuantifyError(error) })
  }

  async updateLlmSubscription(userId: string, subscriptionId: string, body: Record<string, unknown>) {
    return this.quantifyClient.patch(`/llm-strategy-subscriptions/${encodeURIComponent(subscriptionId)}`, {
      ...body,
      userId,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async cancelLlmSubscription(userId: string, subscriptionId: string) {
    return this.quantifyClient.delete(this.buildPath(`/llm-strategy-subscriptions/${encodeURIComponent(subscriptionId)}`, {
      userId,
    })).catch(error => { throw this.mapQuantifyError(error) })
  }

  async getBacktestCapabilities(authorization: string | undefined, requestId?: string) {
    for (let attempt = 1; attempt <= AiQuantProxyService.BACKTEST_CAPABILITIES_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.get('/backtesting/capabilities', {
          headers: this.proxyHeaders(authorization, requestId),
        })
      } catch (error) {
        const isTransientUpstreamFailure = this.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AiQuantProxyService.BACKTEST_CAPABILITIES_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          if (isTransientUpstreamFailure) {
            this.logger.warn(
              `event=backtesting_capabilities_fallback reason=${this.describeError(error)} requestId=${requestId ?? 'N/A'} attempt=${attempt}`,
            )
            return {
              allowedSymbols: [],
              allowedBaseTimeframes: [],
            }
          }
          throw this.mapQuantifyError(error)
        }
        await this.sleep(this.getBacktestCapabilitiesBackoffMs(attempt))
      }
    }

    return {
      allowedSymbols: [],
      allowedBaseTimeframes: [],
    }
  }

  async createBacktestJob(authorization: string | undefined, body: Record<string, unknown>, requestId?: string) {
    return this.quantifyClient.post('/backtesting/jobs', body, {
      headers: this.proxyHeaders(authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async getBacktestJob(authorization: string | undefined, id: string, requestId?: string) {
    return this.quantifyClient.get(`/backtesting/jobs/${encodeURIComponent(id)}`, {
      headers: this.proxyHeaders(authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async getBacktestJobResult(authorization: string | undefined, id: string, requestId?: string) {
    return this.quantifyClient.get(`/backtesting/jobs/${encodeURIComponent(id)}/result`, {
      headers: this.proxyHeaders(authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  private buildPath(path: string, query: Record<string, string | number | boolean | undefined>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
    const queryString = params.toString()
    return queryString.length > 0 ? `${path}?${queryString}` : path
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

  private mapQuantifyError(error: unknown): DomainException {
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
}
