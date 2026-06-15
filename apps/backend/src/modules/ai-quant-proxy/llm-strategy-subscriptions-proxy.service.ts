import type { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import type { LlmSubscriptionResponseDto } from './dto/llm-subscription.response.dto'
import { Inject, Injectable } from '@nestjs/common'
import { AiQuantProxySupportService } from './ai-quant-proxy-support.service'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'

@Injectable()
export class LlmStrategySubscriptionsProxyService {
  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
    @Inject(AiQuantProxySupportService)
    private readonly support: AiQuantProxySupportService,
  ) {}

  async createLlmSubscription(userId: string, body: Record<string, unknown>): Promise<LlmSubscriptionResponseDto> {
    return this.quantifyClient.createLlmSubscription<LlmSubscriptionResponseDto>({
      ...body,
      userId,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async listLlmSubscriptions(
    userId: string,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmSubscriptionResponseDto>> {
    return this.quantifyClient.listLlmSubscriptions<BasePaginationResponseDto<LlmSubscriptionResponseDto>>({
      userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async getLlmSubscriptionDetail(userId: string, subscriptionId: string): Promise<LlmSubscriptionResponseDto> {
    return this.quantifyClient.getLlmSubscriptionDetail<LlmSubscriptionResponseDto>(subscriptionId, userId)
      .catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async updateLlmSubscription(userId: string, subscriptionId: string, body: Record<string, unknown>): Promise<LlmSubscriptionResponseDto> {
    return this.quantifyClient.updateLlmSubscription<LlmSubscriptionResponseDto>(subscriptionId, {
      ...body,
      userId,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async cancelLlmSubscription(userId: string, subscriptionId: string): Promise<void> {
    return this.quantifyClient.cancelLlmSubscription(subscriptionId, userId)
      .catch(error => { throw this.support.mapQuantifyError(error) })
  }
}
