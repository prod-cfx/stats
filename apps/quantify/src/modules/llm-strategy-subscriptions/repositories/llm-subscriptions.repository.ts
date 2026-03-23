import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, SubscriptionStatus } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class LlmSubscriptionsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findByUserAndInstance(userId: string, llmStrategyInstanceId: string) {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findFirst({
        where: { userId, llmStrategyInstanceId },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        // 本地开发环境表尚未创建时，降级为无订阅记录
        return null
      }
      throw error
    }
  }

  async findById(id: string) {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findUnique({
        where: { id },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        return null
      }
      throw error
    }
  }

  async findByIdWithDetails(id: string) {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findUnique({
        where: { id },
        include: {
          llmStrategyInstance: {
            include: {
              strategy: { select: { name: true, description: true, status: true } },
            },
          },
          exchangeAccount: { select: { id: true, exchangeId: true, name: true, isTestnet: true } },
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        return null
      }
      throw error
    }
  }

  async findManyByUser(
    userId: string,
    params: { status?: SubscriptionStatus; skip: number; take: number },
  ) {
    const where: Prisma.UserLlmStrategySubscriptionWhereInput = {
      userId,
      ...(params.status ? { status: params.status } : {}),
    }

    try {
      const [items, total] = await Promise.all([
        this.txHost.tx.userLlmStrategySubscription.findMany({
          where,
          include: {
            llmStrategyInstance: {
              include: {
                strategy: { select: { name: true, description: true, status: true } },
              },
            },
            exchangeAccount: { select: { id: true, exchangeId: true, name: true, isTestnet: true } },
          },
          orderBy: { updatedAt: 'desc' },
          skip: params.skip,
          take: params.take,
        }),
        this.txHost.tx.userLlmStrategySubscription.count({ where }),
      ])

      return { items, total }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        // 本地开发数据库没有表时，返回空列表，避免 /llm-strategy-subscriptions 直接 500
        return { items: [], total: 0 }
      }
      throw error
    }
  }

  async create(data: {
    userId: string
    llmStrategyInstanceId: string
    status?: SubscriptionStatus
    customParams?: Prisma.InputJsonValue
    exchangeAccountId?: string
  }) {
    const payload: Prisma.UserLlmStrategySubscriptionUncheckedCreateInput = {
      userId: data.userId,
      llmStrategyInstanceId: data.llmStrategyInstanceId,
      status: data.status ?? 'active',
      customParams: data.customParams,
      exchangeAccountId: data.exchangeAccountId,
    }

    return this.txHost.tx.userLlmStrategySubscription.create({ data: payload })
  }

  async update(id: string, data: {
    status?: SubscriptionStatus
    customParams?: Prisma.InputJsonValue | null
    exchangeAccountId?: string | null
    unsubscribedAt?: Date | null
  }) {
    const payload: Prisma.UserLlmStrategySubscriptionUncheckedUpdateInput = {}

    if (data.status !== undefined) payload.status = data.status
    if (data.customParams !== undefined) payload.customParams = data.customParams
    if (data.exchangeAccountId !== undefined) payload.exchangeAccountId = data.exchangeAccountId
    if (data.unsubscribedAt !== undefined) payload.unsubscribedAt = data.unsubscribedAt

    return this.txHost.tx.userLlmStrategySubscription.update({
      where: { id },
      data: payload,
    })
  }

  async delete(id: string) {
    return this.txHost.tx.userLlmStrategySubscription.delete({
      where: { id },
    })
  }

  async findLlmStrategyInstance(instanceId: string) {
    try {
      return await this.txHost.tx.llmStrategyInstance.findUnique({
        where: { id: instanceId },
        include: {
          strategy: { select: { id: true, name: true, description: true, status: true } },
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        return null
      }
      throw error
    }
  }

  async findExchangeAccountByOwner(accountId: string, userId: string): Promise<{ id: string } | null> {
    return this.txHost.tx.exchangeAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    })
  }

  async findUserStrategyAccount(userId: string, strategyId: string): Promise<{ id: string } | null> {
    return this.txHost.tx.userStrategyAccount.findUnique({
      where: { userId_strategyId: { userId, strategyId } },
      select: { id: true },
    })
  }

  /**
   * 批量查找指定用户对一批实例的有效订阅（status=active）
   */
  async findActiveByUserAndInstanceIds(
    userId: string,
    instanceIds: string[],
  ): Promise<Array<{ llmStrategyInstanceId: string }>> {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findMany({
        where: { userId, llmStrategyInstanceId: { in: instanceIds }, status: 'active' },
        select: { llmStrategyInstanceId: true },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        return []
      }
      throw error
    }
  }

  /**
   * 查找指定用户对单个实例的有效订阅（status=active）
   */
  async findActiveByUserAndInstance(
    userId: string,
    instanceId: string,
  ): Promise<{ id: string } | null> {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findFirst({
        where: { userId, llmStrategyInstanceId: instanceId, status: 'active' },
        select: { id: true },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        return null
      }
      throw error
    }
  }

  /**
   * 查询指定实例的交易信号列表（分页）
   */
  async findTradingSignalsByInstance(
    instanceId: string,
    params: { skip: number; take: number },
  ) {
    const where = { llmStrategyInstanceId: instanceId }
    const [items, total] = await Promise.all([
      this.txHost.tx.tradingSignal.findMany({
        where,
        include: { symbol: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.txHost.tx.tradingSignal.count({ where }),
    ])
    return { items, total }
  }
}
