import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { QuantifyRequestOptions } from '@/common/clients/quantify-contract.shared'
import { Inject, Injectable } from '@nestjs/common'
import {
  createBackendQuantifyApiClient,
  createQuantifyAbortContext,
  QuantifyClientError,
  resolveQuantifyBaseUrl,
  runQuantifyContractRequest,
} from '@/common/clients/quantify-contract.shared'
import { EnvService } from '@/common/services/env.service'

interface QuantifyErrorPayload {
  status?: number
  error?: {
    code?: string
    args?: Record<string, unknown>
  }
  message?: string
}

@Injectable()
export class QuantifyAiQuantClient {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 10_000
  private static readonly MIN_REQUEST_TIMEOUT_MS = 1_000
  private readonly client = createBackendQuantifyApiClient(this.env)

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  async get<T>(path: string, options?: QuantifyRequestOptions): Promise<T> {
    return this.runUntypedRequest<T>(path, 'GET', options)
  }

  async delete<T>(path: string, options?: QuantifyRequestOptions): Promise<T> {
    return this.runUntypedRequest<T>(path, 'DELETE', options)
  }

  async post<T>(path: string, body?: Record<string, unknown>, options?: QuantifyRequestOptions): Promise<T> {
    return this.runUntypedJsonRequest<T>(path, 'POST', options, body)
  }

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

  async getDeployResult(deployRequestId: string, options: QuantifyRequestOptions & { userId: string }) {
    return this.get(
      `/account/ai-quant/strategies/deploy-requests/${encodeURIComponent(deployRequestId)}/result`,
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
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

  async updateAccountStrategyExecutionLeverage(
    strategyId: string,
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.runRequest(
      signal =>
        this.client.AccountStrategyViewController_updateDeploymentLeverage(body, {
          params: { id: strategyId },
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

  async listStrategyPlazaTemplates() {
    return this.get('/strategy-plaza/templates')
  }

  async getStrategyPlazaTemplateDetail(templateId: string) {
    return this.get(`/strategy-plaza/templates/${encodeURIComponent(templateId)}`)
  }

  async runStrategyPlazaTemplate(
    templateId: string,
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.post(
      `/strategy-plaza/templates/${encodeURIComponent(templateId)}/run`,
      { runRequestId: body.runRequestId },
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
    )
  }

  async startStrategyPlazaEditSession(
    templateId: string,
    options: QuantifyRequestOptions & { userId: string },
  ) {
    return this.post(
      `/strategy-plaza/templates/${encodeURIComponent(templateId)}/edit-session`,
      undefined,
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
    )
  }

  async startCodegen(
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ): Promise<CodegenSessionResponseDto> {
    return this.runUntypedJsonRequest(
      '/llm-strategy-codegen/sessions',
      'POST',
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
      body,
    )
  }

  async getCodegenSession(
    sessionId: string,
    options: QuantifyRequestOptions & { userId: string },
  ): Promise<CodegenSessionResponseDto> {
    return this.runUntypedJsonRequest(
      `/llm-strategy-codegen/sessions/${encodeURIComponent(sessionId)}`,
      'GET',
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
    )
  }

  async continueCodegen(
    sessionId: string,
    body: Record<string, unknown>,
    options: QuantifyRequestOptions & { userId: string },
  ): Promise<CodegenSessionResponseDto> {
    return this.runUntypedJsonRequest(
      `/llm-strategy-codegen/sessions/${encodeURIComponent(sessionId)}/messages`,
      'POST',
      {
        ...options,
        headers: buildUserHeaders(options.userId, options.headers?.authorization),
      },
      body,
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

  private async runUntypedRequest<T>(
    path: string,
    method: 'GET' | 'DELETE',
    options?: QuantifyRequestOptions,
  ): Promise<T> {
    return this.runUntypedJsonRequest(path, method, options)
  }

  private async runUntypedJsonRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    options?: QuantifyRequestOptions,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const abortContext = createQuantifyAbortContext(this.getRequestTimeoutMs(options?.timeoutMs), options?.signal)
    try {
      let response: Response
      try {
        response = await fetch(`${resolveQuantifyBaseUrl(this.env)}${path}`, {
          method,
          signal: abortContext.signal,
          headers: {
            'content-type': 'application/json',
            ...(options?.headers ?? {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        })
      } catch (error) {
        throw new QuantifyClientError(
          'Quantify request failed',
          502,
          'UPSTREAM_REQUEST_FAILED',
          {
            cause: stringifyCause(abortContext.getAbortReason() ?? error),
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

      if (typeof payload === 'object' && payload !== null && 'data' in payload) {
        return (payload as { data: T }).data
      }

      return payload as T
    } finally {
      abortContext.cleanup()
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

function tryParseJson<T>(raw: string): T | null {
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function stringifyCause(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  if (value === undefined) return 'unknown'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export { QuantifyClientError }
