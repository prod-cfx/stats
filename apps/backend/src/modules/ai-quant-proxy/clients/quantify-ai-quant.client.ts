import { Inject, Injectable } from '@nestjs/common'
import {
  createBackendQuantifyApiClient,
  createQuantifyAbortContext,
  QuantifyClientError,
  QuantifyRequestOptions,
  runQuantifyContractRequest,
} from '@/common/clients/quantify-contract.shared'
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class QuantifyAiQuantClient {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 10_000
  private static readonly MIN_REQUEST_TIMEOUT_MS = 1_000
  private readonly client = createBackendQuantifyApiClient(this.env)

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async listAccountStrategies(
    query: Record<string, string | number | boolean | undefined>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runRequest(
      signal =>
        this.client.AccountStrategyViewController_list({
          queries: {
            userId: options.userId,
            page: numberOrUndefined(query.page),
            limit: numberOrUndefined(query.limit),
            status: stringOrUndefined(query.status) as 'draft' | 'running' | 'stopped' | undefined,
            subscribedOnly: booleanOrUndefined(query.subscribedOnly),
            excludeDraft: booleanOrUndefined(query.excludeDraft),
          },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async getAccountStrategyDetail(strategyId: string, options: QuantifyRequestOptions & { userId: string }) {
    return this.runRequest(
      signal =>
        this.client.AccountStrategyViewController_detail({
          params: { id: strategyId },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async performAccountStrategyAction(
    strategyId: string,
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runRequest(
      signal =>
        this.client.AccountStrategyViewController_action(body, {
          params: { id: strategyId },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async deployAccountStrategy(body: Record<string, unknown>, options: QuantifyRequestOptions & { userId: string }) {
    return this.runRequest(
      signal =>
        this.client.AccountStrategyViewController_deploy(body, {
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async deleteAccountStrategy(strategyId: string, options: QuantifyRequestOptions & { userId: string }): Promise<void> {
    await this.runRequest<void>(
      signal =>
        this.client.AccountStrategyViewController_remove(undefined, {
          params: { id: strategyId },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async startCodegen(body: Record<string, unknown>, options: QuantifyRequestOptions & { userId: string }) {
    return this.runTimedRequest(
      signal =>
        this.client.LiveLlmStrategyCodegenController_startSession(body, {
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }),
      options.timeoutMs,
      options.signal,
    )
  }

  async getCodegenSession(sessionId: string, options: QuantifyRequestOptions & { userId: string }) {
    return this.runTimedRequest(
      signal =>
        this.client.LiveLlmStrategyCodegenController_getSession({
          params: { id: sessionId },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }),
      options.timeoutMs,
      options.signal,
    )
  }

  async continueCodegen(
    sessionId: string,
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runTimedRequest(
      signal =>
        this.client.LiveLlmStrategyCodegenController_continueSession(body, {
          params: { id: sessionId },
          headers: buildUserHeaders(options.userId, options.headers?.authorization),
          signal,
        }),
      options.timeoutMs,
      options.signal,
    )
  }

  async listLlmInstances(query: Record<string, string | number | undefined>) {
    return this.runRequest(() =>
      this.client.LiveLlmStrategyInstancesController_list({
        queries: {
          page: numberOrUndefined(query.page),
          limit: numberOrUndefined(query.limit),
          llmModel: stringOrUndefined(query.llmModel),
          strategyId: stringOrUndefined(query.strategyId),
          userId: stringOrUndefined(query.userId),
        },
      }),
    )
  }

  async getLlmInstanceDetail(id: string, userId?: string) {
    return this.runRequest(() =>
      this.client.LiveLlmStrategyInstancesController_detail({
        params: { id },
        queries: { userId: stringOrUndefined(userId) },
      }),
    )
  }

  async listLlmInstanceSignals(
    id: string,
    query: Record<string, string | number | undefined> & { userId: string },
  ) {
    return this.runRequest(() =>
      this.client.LiveLlmStrategyInstancesController_listSignals({
        params: { id },
        queries: {
          userId: query.userId,
          page: numberOrUndefined(query.page),
          limit: numberOrUndefined(query.limit),
        },
      }),
    )
  }

  async createLlmSubscription(body: Record<string, unknown>) {
    return this.runRequest(() =>
      this.client.LlmStrategySubscriptionsController_subscribe(body as never),
    )
  }

  async listLlmSubscriptions(query: Record<string, string | number | undefined> & { userId: string }) {
    return this.runRequest(() =>
      this.client.LlmStrategySubscriptionsController_listMySubscriptions({
        queries: {
          userId: query.userId,
          page: numberOrUndefined(query.page),
          limit: numberOrUndefined(query.limit),
          status: stringOrUndefined(query.status) as 'active' | 'paused' | 'cancelled' | undefined,
        },
      }),
    )
  }

  async getLlmSubscriptionDetail(subscriptionId: string, userId: string) {
    return this.runRequest(() =>
      this.client.LlmStrategySubscriptionsController_detail({
        params: { subscriptionId },
        queries: { userId },
      }),
    )
  }

  async updateLlmSubscription(subscriptionId: string, body: Record<string, unknown>) {
    return this.runRequest(() =>
      this.client.LlmStrategySubscriptionsController_update(body as never, {
        params: { subscriptionId },
      }),
    )
  }

  async cancelLlmSubscription(subscriptionId: string, userId: string): Promise<void> {
    await this.runRequest<void>(() =>
      this.client.LlmStrategySubscriptionsController_cancel(undefined, {
        params: { subscriptionId },
        queries: { userId },
      }),
    )
  }

  async getBacktestCapabilities(options: QuantifyRequestOptions) {
    return this.runRequest(
      signal =>
        this.client.BacktestingController_getCapabilities({
          headers: buildProxyHeaders(options.headers?.authorization, headerValue(options.headers, 'x-request-id')),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async createBacktestJob(
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runRequest(
      signal =>
        this.client.BacktestingController_createJob(body, {
          headers: buildUserProxyHeaders(
            options.userId,
            options.headers?.authorization,
            headerValue(options.headers, 'x-request-id'),
          ),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async checkBacktestSymbolSupport(
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runRequest(
      signal =>
        this.client.BacktestingController_checkSymbolSupport(body, {
          headers: buildUserProxyHeaders(
            options.userId,
            options.headers?.authorization,
            headerValue(options.headers, 'x-request-id'),
          ),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async getBacktestJob(id: string, options: QuantifyRequestOptions & { userId: string }) {
    return this.runRequest(
      signal =>
        this.client.BacktestingController_getJob({
          params: { id },
          headers: buildUserProxyHeaders(
            options.userId,
            options.headers?.authorization,
            headerValue(options.headers, 'x-request-id'),
          ),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  async getBacktestJobResult(id: string, options: QuantifyRequestOptions & { userId: string }) {
    return this.runRequest(
      signal =>
        this.client.BacktestingController_getJobResult({
          params: { id },
          headers: buildUserProxyHeaders(
            options.userId,
            options.headers?.authorization,
            headerValue(options.headers, 'x-request-id'),
          ),
          signal,
        }) as Promise<unknown>,
      options,
    )
  }

  private async runRequest<T>(
    request: (signal?: AbortSignal) => Promise<unknown>,
    options?: QuantifyRequestOptions,
  ): Promise<T> {
    const abortContext = createQuantifyAbortContext(undefined, options?.signal)
    try {
      return await runQuantifyContractRequest<T>(
        () => request(abortContext?.signal),
        abortContext?.getAbortReason,
      )
    } finally {
      abortContext?.cleanup()
    }
  }

  private async runTimedRequest<T>(
    request: (signal?: AbortSignal) => Promise<unknown>,
    timeoutMs?: number,
    upstreamSignal?: AbortSignal,
  ): Promise<T> {
    const effectiveTimeoutMs = this.getRequestTimeoutMs(timeoutMs)
    const abortContext = createQuantifyAbortContext(effectiveTimeoutMs, upstreamSignal)
    try {
      return await runQuantifyContractRequest<T>(
        () => request(abortContext?.signal),
        abortContext?.getAbortReason,
      )
    } finally {
      abortContext?.cleanup()
    }
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

function buildUserHeaders(userId: string, authorization: string | undefined): Record<string, string> {
  return {
    'x-user-id': userId,
    ...(authorization ? { authorization } : {}),
  }
}

function buildProxyHeaders(authorization: string | undefined, requestId?: string): Record<string, string> {
  return {
    ...(authorization ? { authorization } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

function buildUserProxyHeaders(userId: string, authorization: string | undefined, requestId?: string): Record<string, string> {
  return {
    ...buildUserHeaders(userId, authorization),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  return headers?.[name]
}

function numberOrUndefined(value: string | number | boolean | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim().length > 0) return Number(value)
  return undefined
}

function booleanOrUndefined(value: string | number | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  return undefined
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export { QuantifyClientError }
