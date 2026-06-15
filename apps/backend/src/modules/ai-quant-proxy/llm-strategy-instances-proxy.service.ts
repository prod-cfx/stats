import type { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import type { LlmStrategyInstanceResponseDto } from './dto/llm-strategy-instance.response.dto'
import type { LlmStrategyInstanceSignalResponseDto } from './dto/llm-strategy-instance-signal.response.dto'
import { Inject, Injectable } from '@nestjs/common'
import { AiQuantProxySupportService } from './ai-quant-proxy-support.service'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'

@Injectable()
export class LlmStrategyInstancesProxyService {
  constructor(
    @Inject(QuantifyAiQuantClient)
    private readonly quantifyClient: QuantifyAiQuantClient,
    @Inject(AiQuantProxySupportService)
    private readonly support: AiQuantProxySupportService,
  ) {}

  async listLlmInstances(
    userId: string | undefined,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceResponseDto>> {
    return this.quantifyClient.listLlmInstances<BasePaginationResponseDto<LlmStrategyInstanceResponseDto>>({
      page: query.page,
      limit: query.limit,
      llmModel: query.llmModel,
      strategyId: query.strategyId,
      userId,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async getLlmInstanceDetail(id: string, userId?: string): Promise<LlmStrategyInstanceResponseDto> {
    return this.quantifyClient.getLlmInstanceDetail<LlmStrategyInstanceResponseDto>(id, userId)
      .catch(error => { throw this.support.mapQuantifyError(error) })
  }

  async listLlmInstanceSignals(
    userId: string,
    id: string,
    query: Record<string, string | number | undefined>,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceSignalResponseDto>> {
    return this.quantifyClient.listLlmInstanceSignals<BasePaginationResponseDto<LlmStrategyInstanceSignalResponseDto>>(id, {
      userId,
      page: query.page,
      limit: query.limit,
    }).catch(error => { throw this.support.mapQuantifyError(error) })
  }
}
