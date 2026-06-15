import type { BaseResponseDto } from '@/common/dto/base.dto'
import type { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import type {
  AccountAiQuantStrategyDeployResultResponseDto,
  AccountAiQuantStrategyDetailResponseDto,
  AccountAiQuantStrategyListItemResponseDto,
} from './dto/account-ai-quant-strategy.response.dto'
import type { AiQuantConversationResponseDto } from './dto/ai-quant-conversation.response.dto'
import type { BacktestingCapabilitiesResponseDto } from './dto/backtesting-capabilities.response.dto'
import type { BacktestingCreateJobResponseDto } from './dto/backtesting-create-job.dto'
import type { BacktestingJobResponseDto } from './dto/backtesting-job.response.dto'
import type { BacktestingReportResponseDto } from './dto/backtesting-report.response.dto'
import type { BacktestingSymbolSupportResponseDto } from './dto/backtesting-symbol-support.dto'
import type { CodegenSessionResponseDto } from './dto/codegen-session.response.dto'
import type { LlmStrategyInstanceResponseDto } from './dto/llm-strategy-instance.response.dto'
import type { LlmStrategyInstanceSignalResponseDto } from './dto/llm-strategy-instance-signal.response.dto'
import type { LlmSubscriptionResponseDto } from './dto/llm-subscription.response.dto'
import type {
  StrategyPlazaEditSessionResponseDto,
  StrategyPlazaRunResponseDto,
  StrategyPlazaTemplateResponseDto,
} from './dto/strategy-plaza.response.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AccountAiQuantStrategiesProxyService } from './account-ai-quant-strategies-proxy.service'
import { AiQuantProxySupportService } from './ai-quant-proxy-support.service'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'
import { LlmStrategyInstancesProxyService } from './llm-strategy-instances-proxy.service'
import { LlmStrategySubscriptionsProxyService } from './llm-strategy-subscriptions-proxy.service'

@Injectable()
export class AiQuantProxyService {
  private static readonly BACKTEST_CAPABILITIES_RETRY_ATTEMPTS = 3
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_BASE_MS = 200
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_MAX_MS = 1_500
  private static readonly BACKTEST_CAPABILITIES_BACKOFF_JITTER_MS = 100
  private static readonly BACKTEST_JOB_RETRY_ATTEMPTS = 3
  private static readonly BACKTEST_JOB_BACKOFF_BASE_MS = 200
  private static readonly BACKTEST_JOB_BACKOFF_MAX_MS = 800
  private static readonly CODEGEN_REQUEST_TIMEOUT_MS = 60_000
  private readonly logger = new Logger(AiQuantProxyService.name)

  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
    @Inject(AiQuantProxySupportService)
    private readonly support: AiQuantProxySupportService,
    @Inject(AccountAiQuantStrategiesProxyService)
    private readonly accountStrategiesService: AccountAiQuantStrategiesProxyService,
    @Inject(LlmStrategyInstancesProxyService)
    private readonly llmInstancesService: LlmStrategyInstancesProxyService,
    @Inject(LlmStrategySubscriptionsProxyService)
    private readonly llmSubscriptionsService: LlmStrategySubscriptionsProxyService,
  ) {}

  async listAccountStrategies(
    userId: string,
    authorization: string | undefined,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<BasePaginationResponseDto<AccountAiQuantStrategyListItemResponseDto>> {
    return this.accountStrategiesService.listAccountStrategies(userId, authorization, query)
  }

  async getAccountStrategyDetail(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.accountStrategiesService.getAccountStrategyDetail(userId, authorization, strategyId)
  }

  async getDeployResult(
    userId: string,
    authorization: string | undefined,
    deployRequestId: string,
  ): Promise<AccountAiQuantStrategyDeployResultResponseDto> {
    return this.accountStrategiesService.getDeployResult(userId, authorization, deployRequestId)
  }

  async performAccountStrategyAction(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.accountStrategiesService.performAccountStrategyAction(userId, authorization, strategyId, body)
  }

  async deployAccountStrategy(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.accountStrategiesService.deployAccountStrategy(userId, authorization, body)
  }

  async updateAccountStrategyExecutionLeverage(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    body: Record<string, unknown>,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.accountStrategiesService.updateAccountStrategyExecutionLeverage(userId, authorization, strategyId, body)
  }

  async deleteAccountStrategy(
    userId: string,
    authorization: string | undefined,
    strategyId: string,
    options: { deleteStoppedStrategy?: boolean } = {},
  ): Promise<void> {
    await this.accountStrategiesService.deleteAccountStrategy(userId, authorization, strategyId, options)
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

  async listStrategyPlazaTemplates(): Promise<StrategyPlazaTemplateResponseDto[]> {
    return this.quantifyClient.listStrategyPlazaTemplates<StrategyPlazaTemplateResponseDto[]>()
      .catch(error => { throw this.mapQuantifyError(error) })
  }

  async getStrategyPlazaTemplateDetail(templateId: string): Promise<StrategyPlazaTemplateResponseDto> {
    return this.quantifyClient.getStrategyPlazaTemplateDetail<StrategyPlazaTemplateResponseDto>(templateId)
      .catch(error => { throw this.mapQuantifyError(error) })
  }

  async listStrategyPlazaTemplateSignals(templateId: string, limit?: number): Promise<unknown[]> {
    return this.quantifyClient.listStrategyPlazaTemplateSignals<unknown[]>(templateId, limit)
      .catch(error => { throw this.mapQuantifyError(error) })
  }

  async getStrategyPlazaTemplateEquityCurve(templateId: string, timeframe?: string): Promise<number[]> {
    return this.quantifyClient.getStrategyPlazaTemplateEquityCurve<number[]>(templateId, timeframe)
      .catch(error => { throw this.mapQuantifyError(error) })
  }

  async runStrategyPlazaTemplate(
    userId: string,
    authorization: string | undefined,
    templateId: string,
    body: Record<string, unknown>,
  ): Promise<StrategyPlazaRunResponseDto> {
    return this.quantifyClient.runStrategyPlazaTemplate<StrategyPlazaRunResponseDto>(
      templateId,
      { runRequestId: body.runRequestId },
      { userId, headers: this.userHeaders(userId, authorization) },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async startStrategyPlazaEditSession(
    userId: string,
    authorization: string | undefined,
    templateId: string,
    options: { locale?: string } = {},
  ): Promise<StrategyPlazaEditSessionResponseDto> {
    return this.quantifyClient.startStrategyPlazaEditSession<StrategyPlazaEditSessionResponseDto>(
      templateId,
      {
        userId,
        headers: this.userHeaders(userId, authorization),
        locale: options.locale,
        timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      },
    ).catch(error => { throw this.mapQuantifyError(error) })
  }

  async deleteAiQuantConversation(
    userId: string,
    authorization: string | undefined,
    conversationId: string,
    options: { deleteStoppedStrategy?: boolean } = {},
  ): Promise<void> {
    const search = options.deleteStoppedStrategy ? '?deleteStoppedStrategy=true' : ''
    return this.quantifyClient.delete<void>(`/account/ai-quant/conversations/${encodeURIComponent(conversationId)}${search}`, {
      timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
      headers: this.userHeaders(userId, authorization),
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async updateAiQuantConversationBacktestDraft(
    userId: string,
    authorization: string | undefined,
    conversationId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    return this.quantifyClient.patch<void>(
      `/account/ai-quant/conversations/${encodeURIComponent(conversationId)}/backtest-draft`,
      body,
      {
        timeoutMs: AiQuantProxyService.CODEGEN_REQUEST_TIMEOUT_MS,
        headers: this.userHeaders(userId, authorization),
      },
    ).catch(error => { throw this.mapQuantifyError(error) })
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

  async listLlmInstances(
    userId: string | undefined,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceResponseDto>> {
    return this.llmInstancesService.listLlmInstances(userId, query)
  }

  async getLlmInstanceDetail(id: string, userId?: string): Promise<LlmStrategyInstanceResponseDto> {
    return this.llmInstancesService.getLlmInstanceDetail(id, userId)
  }

  async listLlmInstanceSignals(
    userId: string,
    id: string,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceSignalResponseDto>> {
    return this.llmInstancesService.listLlmInstanceSignals(userId, id, query)
  }

  async createLlmSubscription(userId: string, body: Record<string, unknown>): Promise<LlmSubscriptionResponseDto> {
    return this.llmSubscriptionsService.createLlmSubscription(userId, body)
  }

  async listLlmSubscriptions(
    userId: string,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmSubscriptionResponseDto>> {
    return this.llmSubscriptionsService.listLlmSubscriptions(userId, query)
  }

  async getLlmSubscriptionDetail(userId: string, subscriptionId: string): Promise<LlmSubscriptionResponseDto> {
    return this.llmSubscriptionsService.getLlmSubscriptionDetail(userId, subscriptionId)
  }

  async updateLlmSubscription(userId: string, subscriptionId: string, body: Record<string, unknown>): Promise<LlmSubscriptionResponseDto> {
    return this.llmSubscriptionsService.updateLlmSubscription(userId, subscriptionId, body)
  }

  async cancelLlmSubscription(userId: string, subscriptionId: string): Promise<void> {
    return this.llmSubscriptionsService.cancelLlmSubscription(userId, subscriptionId)
  }

  async getBacktestCapabilities(
    authorization: string | undefined,
    requestId?: string,
  ): Promise<BaseResponseDto<BacktestingCapabilitiesResponseDto>> {
    let lastError: unknown

    for (let attempt = 1; attempt <= AiQuantProxyService.BACKTEST_CAPABILITIES_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.getBacktestCapabilities<BaseResponseDto<BacktestingCapabilitiesResponseDto>>({
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
  ): Promise<BaseResponseDto<BacktestingCreateJobResponseDto>> {
    return this.quantifyClient.createBacktestJob<BaseResponseDto<BacktestingCreateJobResponseDto>>(body, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async checkBacktestSymbolSupport(
    userId: string,
    authorization: string | undefined,
    body: Record<string, unknown>,
    requestId?: string,
  ): Promise<BacktestingSymbolSupportResponseDto> {
    return this.quantifyClient.checkBacktestSymbolSupport<BacktestingSymbolSupportResponseDto>(body, {
      userId,
      headers: this.userProxyHeaders(userId, authorization, requestId),
    }).catch(error => { throw this.mapBacktestingJobError(error, requestId) })
  }

  async getBacktestJob(
    userId: string,
    authorization: string | undefined,
    id: string,
    requestId?: string,
  ): Promise<BaseResponseDto<BacktestingJobResponseDto>> {
    for (let attempt = 1; attempt <= AiQuantProxyService.BACKTEST_JOB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.getBacktestJob<BaseResponseDto<BacktestingJobResponseDto>>(id, {
          userId,
          headers: this.userProxyHeaders(userId, authorization, requestId),
        })
      } catch (error) {
        const isTransientUpstreamFailure = this.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AiQuantProxyService.BACKTEST_JOB_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          throw this.mapBacktestingJobError(error, requestId)
        }
        this.logger.warn(
          `event=backtesting_job_retry jobId=${id} reason=${this.describeError(error)} attempt=${attempt} requestId=${requestId ?? 'N/A'}`,
        )
        await this.sleep(this.getBacktestJobBackoffMs(attempt))
      }
    }

    throw new DomainException('Backtesting upstream temporarily unavailable', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
  }

  async getBacktestJobResult(
    userId: string,
    authorization: string | undefined,
    id: string,
    requestId?: string,
  ): Promise<BaseResponseDto<BacktestingReportResponseDto>> {
    for (let attempt = 1; attempt <= AiQuantProxyService.BACKTEST_JOB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.quantifyClient.getBacktestJobResult<BaseResponseDto<BacktestingReportResponseDto>>(id, {
          userId,
          headers: this.userProxyHeaders(userId, authorization, requestId),
        })
      } catch (error) {
        const isTransientUpstreamFailure = this.isTransientUpstreamFailure(error)
        const isLastAttempt = attempt >= AiQuantProxyService.BACKTEST_JOB_RETRY_ATTEMPTS
        if (!isTransientUpstreamFailure || isLastAttempt) {
          throw this.mapBacktestingJobError(error, requestId)
        }
        this.logger.warn(
          `event=backtesting_job_result_retry jobId=${id} reason=${this.describeError(error)} attempt=${attempt} requestId=${requestId ?? 'N/A'}`,
        )
        await this.sleep(this.getBacktestJobBackoffMs(attempt))
      }
    }

    throw new DomainException('Backtesting upstream temporarily unavailable', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
  }

  private userHeaders(userId: string, authorization: string | undefined) {
    return this.support.userHeaders(userId, authorization)
  }

  private authorizationHeaders(authorization: string | undefined) {
    return this.support.authorizationHeaders(authorization)
  }

  private proxyHeaders(authorization: string | undefined, requestId?: string) {
    return this.support.proxyHeaders(authorization, requestId)
  }

  private userProxyHeaders(userId: string, authorization: string | undefined, requestId?: string) {
    return this.support.userProxyHeaders(userId, authorization, requestId)
  }

  private mapQuantifyError(error: unknown): DomainException {
    return this.support.mapQuantifyError(error)
  }

  private mapBacktestingJobError(error: unknown, requestId?: string): DomainException {
    return this.support.mapBacktestingJobError(error, requestId)
  }

  private isTransientUpstreamFailure(error: unknown): boolean {
    return this.support.isTransientUpstreamFailure(error)
  }

  private getBacktestJobBackoffMs(attempt: number): number {
    return Math.min(
      AiQuantProxyService.BACKTEST_JOB_BACKOFF_MAX_MS,
      AiQuantProxyService.BACKTEST_JOB_BACKOFF_BASE_MS * (2 ** (attempt - 1)),
    )
  }

  private describeError(error: unknown): string {
    return this.support.describeError(error)
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
