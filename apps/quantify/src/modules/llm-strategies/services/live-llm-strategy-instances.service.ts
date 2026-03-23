import type { LiveLlmStrategyInstanceListQueryDto } from '../dto/live-llm-strategy-instance-list-query.dto'
import type { LiveLlmStrategySignalsQueryDto } from '../dto/live-llm-strategy-signals-query.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { EnvService } from '@/common/services/env.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { LlmSubscriptionsRepository } from '@/modules/llm-strategy-subscriptions/repositories/llm-subscriptions.repository'
import { TradingSignalResponseDto } from '@/modules/strategy-signals/dto/trading-signal-response.dto'
import { LlmStrategyInstancePublicResponseDto } from '../dto/live-llm-strategy-instance-response.dto'
import { LlmStrategyInstanceNotFoundException } from '../exceptions/llm-strategy-instance-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { LlmStrategyInstancesRepository } from '../repositories'

@Injectable()
export class LiveLlmStrategyInstancesService {
  constructor(
    private readonly instancesRepo: LlmStrategyInstancesRepository,
    private readonly subscriptionsRepo: LlmSubscriptionsRepository,
    private readonly env: EnvService,
  ) {}

  /**
   * 公开入口：获取运行中的 LLM 策略实例列表
   * - 生产环境：仅返回 status=running 且 mode=LIVE 且所属策略为 live 的实例
   * - 开发环境：放宽限制（主要用于本地联调）
   */
  async listRunningInstances(
    query: LiveLlmStrategyInstanceListQueryDto,
    userId?: string,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstancePublicResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const { items, total } = await this.instancesRepo.findRunningLiveInstances({
      llmModel: query.llmModel,
      strategyId: query.strategyId,
      skip,
      take: limit,
    })

    const subscriptionMap = new Map<string, boolean>()
    if (userId) {
      const instanceIds = items.map(item => item.id)
      if (instanceIds.length > 0) {
        const subs = await this.subscriptionsRepo.findActiveByUserAndInstanceIds(userId, instanceIds)
        subs.forEach(sub => subscriptionMap.set(sub.llmStrategyInstanceId, true))
      }
    }

    const data = items.map(
      item => new LlmStrategyInstancePublicResponseDto(item, { isSubscribed: subscriptionMap.get(item.id) ?? false }),
    )

    return new BasePaginationResponseDto<LlmStrategyInstancePublicResponseDto>(total, page, limit, data)
  }

  /**
   * 用户端：获取运行中的 LLM 策略实例详情（公开）
   */
  async getRunningInstanceDetail(
    id: string,
    userId?: string,
  ): Promise<LlmStrategyInstancePublicResponseDto> {
    const instance = await this.instancesRepo.findByIdWithStrategyDetail(id)

    if (!instance) {
      throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
    }

    if (!this.env.isDev()) {
      if (instance.status !== 'running') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
      if (instance.mode !== 'LIVE') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
      if (instance.strategy.status !== 'live') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
    }

    let isSubscribed = false
    if (userId) {
      const sub = await this.subscriptionsRepo.findActiveByUserAndInstance(userId, id)
      isSubscribed = !!sub
    }

    return new LlmStrategyInstancePublicResponseDto(instance, { isSubscribed })
  }

  /**
   * 用户端：LLM 策略实例信号列表
   * - 生产环境：要求用户必须订阅后才可访问（避免泄露策略行为细节）
   */
  async getRunningInstanceSignals(
    id: string,
    query: LiveLlmStrategySignalsQueryDto,
    userId: string,
  ): Promise<BasePaginationResponseDto<TradingSignalResponseDto>> {
    // 校验实例可见性
    await this.getRunningInstanceDetail(id, userId)

    if (!this.env.isDev()) {
      const hasSubscription = await this.subscriptionsRepo.findActiveByUserAndInstance(userId, id)
      if (!hasSubscription) {
        throw new DomainException('llm_strategy.instance_access_forbidden', {
          code: ErrorCode.LLM_STRATEGY_INSTANCE_FORBIDDEN,
          status: HttpStatus.FORBIDDEN,
          args: { instanceId: id, userId },
        })
      }
    }

    const skip = (query.page - 1) * query.limit
    const { items, total } = await this.subscriptionsRepo.findTradingSignalsByInstance(id, {
      skip,
      take: query.limit,
    })

    return new BasePaginationResponseDto(
      total,
      query.page,
      query.limit,
      items.map(item => new TradingSignalResponseDto(item)),
    )
  }
}
