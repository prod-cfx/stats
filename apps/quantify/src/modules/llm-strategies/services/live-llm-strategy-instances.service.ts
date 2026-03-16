import type { LiveLlmStrategyInstanceListQueryDto } from '../dto/live-llm-strategy-instance-list-query.dto'
import type { LiveLlmStrategySignalsQueryDto } from '../dto/live-llm-strategy-signals-query.dto'
import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@/prisma/prisma.types'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

// eslint-disable-next-line ts/consistent-type-imports -- Nest 注入需要运行时类
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'
import { LlmStrategyInstancePublicResponseDto } from '../dto/live-llm-strategy-instance-response.dto'
import { LlmStrategyInstanceNotFoundException } from '../exceptions/llm-strategy-instance-not-found.exception'

@Injectable()
export class LiveLlmStrategyInstancesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const client = this.prisma.getClient()

    // 为了与产品预期一致：无论环境都只返回“运行中”的实例
    // - status 必须为 running
    // - mode 必须为 LIVE
    // - 所属策略必须为 live
    const where = {
      status: 'running' as LlmStrategyInstanceStatus,
      mode: 'LIVE' as LlmStrategyInstanceMode,
      strategy: { status: 'live' as const },
      ...(query.llmModel ? { llmModel: query.llmModel } : {}),
      ...(query.strategyId ? { strategyId: query.strategyId } : {}),
    }

    const [items, total] = await Promise.all([
      client.llmStrategyInstance.findMany({
        where,
        include: {
          strategy: { select: { name: true, description: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      client.llmStrategyInstance.count({ where }),
    ])

    const subscriptionMap = new Map<string, boolean>()
    if (userId) {
      const instanceIds = items.map(item => item.id)
      if (instanceIds.length > 0) {
        try {
          const subs = await client.userLlmStrategySubscription.findMany({
            where: {
              userId,
              llmStrategyInstanceId: { in: instanceIds },
              status: 'active',
            },
            select: { llmStrategyInstanceId: true },
          })
          subs.forEach(sub => subscriptionMap.set(sub.llmStrategyInstanceId, true))
        } catch (error) {
          // 本地开发环境可能尚未执行 LLM 订阅相关迁移，表不存在时降级为未订阅状态
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2021' &&
            String(error.message).includes('user_llm_strategy_subscriptions')
          ) {
            // ignore and treat all as not subscribed
          } else {
            throw error
          }
        }
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
    const client = this.prisma.getClient()

    const instance = await client.llmStrategyInstance.findUnique({
      where: { id },
      include: {
        strategy: { select: { name: true, description: true, status: true } },
      },
    })

    if (!instance) {
      throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
    }

    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    if (!isDevEnv) {
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
      try {
        const sub = await client.userLlmStrategySubscription.findFirst({
          where: {
            userId,
            llmStrategyInstanceId: id,
            status: 'active',
          },
          select: { id: true },
        })
        isSubscribed = !!sub
      } catch (error) {
        // 表不存在时在本地开发环境降级为未订阅状态，避免整个详情接口 500
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2021' &&
          String(error.message).includes('user_llm_strategy_subscriptions')
        ) {
          isSubscribed = false
        } else {
          throw error
        }
      }
    }

    return new LlmStrategyInstancePublicResponseDto(instance, { isSubscribed })
  }

  /**
   * 用户端：LLM 策略实例信号列表（当前先返回空列表；后续可接入 runs/生成信号持久化）
   * - 生产环境：要求用户必须订阅后才可访问（避免泄露策略行为细节）
   */
  async getRunningInstanceSignals(
    id: string,
    query: LiveLlmStrategySignalsQueryDto,
    userId: string,
  ): Promise<BasePaginationResponseDto<any>> {
    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    // 校验实例可见性
    await this.getRunningInstanceDetail(id, userId)

    if (!isDevEnv) {
      const client = this.prisma.getClient()
      try {
        const hasSubscription = await client.userLlmStrategySubscription.findFirst({
          where: {
            userId,
            llmStrategyInstanceId: id,
            status: 'active',
          },
          select: { id: true },
        })
        if (!hasSubscription) {
          throw new ForbiddenException('仅订阅该策略的用户可以查看详细信号')
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2021' &&
          String(error.message).includes('user_llm_strategy_subscriptions')
        ) {
          // 生产环境表不存在属于配置错误，这里仍然抛出 500 以便告警
          throw error
        }
        throw error
      }
    }

    return new BasePaginationResponseDto(0, query.page, query.limit, [])
  }
}
