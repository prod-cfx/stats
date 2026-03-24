import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { QuantifyAiQuantClient, QuantifyClientError } from './clients/quantify-ai-quant.client'

@Injectable()
export class AiQuantProxyService {
  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
  ) {}

  async listAccountStrategies(
    userId: string,
    authorization: string | undefined,
    query: Record<string, string | number | undefined>,
  ) {
    return this.quantifyClient.get(this.buildPath('/account/ai-quant/strategies', {
      userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
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

  async startCodegen(user: AuthenticatedUser, body: Record<string, unknown>) {
    return this.quantifyClient.post('/llm-strategy-codegen/sessions', {
      ...body,
      userId: user.id,
    }).catch(error => { throw this.mapQuantifyError(error) })
  }

  async continueCodegen(user: AuthenticatedUser, sessionId: string, body: Record<string, unknown>) {
    return this.quantifyClient.post(`/llm-strategy-codegen/sessions/${encodeURIComponent(sessionId)}/messages`, {
      ...body,
      userId: user.id,
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

  private buildPath(path: string, query: Record<string, string | number | undefined>) {
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
}
