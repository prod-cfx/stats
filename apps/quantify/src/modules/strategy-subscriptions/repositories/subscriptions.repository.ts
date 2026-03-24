import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { SubscriptionStatus } from '@ai/shared'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findByUserAndStrategy(userId: string, strategyInstanceId: string) {
    return this.txHost.tx.userStrategySubscription.findFirst({
      where: {
        userId,
        strategyInstanceId,
      },
    })
  }

  async findById(id: string) {
    return this.txHost.tx.userStrategySubscription.findUnique({
      where: { id },
    })
  }

  async findByIdWithDetails(id: string) {
    return this.txHost.tx.userStrategySubscription.findUnique({
      where: { id },
      include: {
        strategyInstance: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            strategyTemplate: {
              select: {
                id: true,
                name: true,
                description: true,
                status: true,
              },
            },
          },
        },
        exchangeAccount: {
          select: {
            id: true,
            exchangeId: true,
            name: true,
          },
        },
      },
    })
  }

  /**
   * 查询订阅及其校验所需的数据（用于参数校验场景）
   */
  async findByIdWithValidationData(id: string) {
    return this.txHost.tx.userStrategySubscription.findUnique({
      where: { id },
      include: {
        strategyInstance: {
          select: {
            id: true,
            status: true,
            mode: true, // 🔴 新增：带出 mode 字段用于恢复订阅时的校验
            strategyTemplate: {
              select: {
                id: true,
                status: true,
                requiredFields: true,
                paramsSchema: true,
              },
            },
          },
        },
      },
    })
  }

  async findManyByUser(
    userId: string,
    options: {
      status?: SubscriptionStatus
      skip?: number
      take?: number
    } = {},
  ) {
    const where: Prisma.UserStrategySubscriptionWhereInput = {
      userId,
    }

    if (options.status) {
      where.status = options.status
    }

    const [items, total] = await Promise.all([
      this.txHost.tx.userStrategySubscription.findMany({
        where,
        include: {
          strategyInstance: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              strategyTemplate: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  status: true,
                },
              },
            },
          },
          exchangeAccount: {
            select: {
              id: true,
              exchangeId: true,
              name: true,
            },
          },
        },
        orderBy: {
          subscribedAt: 'desc',
        },
        skip: options.skip,
        take: options.take,
      }),
      this.txHost.tx.userStrategySubscription.count({ where }),
    ])

    return { items, total }
  }

  async create(data: {
    userId: string
    strategyInstanceId: string
    status?: SubscriptionStatus
    customParams?: Prisma.InputJsonValue
    exchangeAccountId?: string
  }) {
    const payload: Prisma.UserStrategySubscriptionUncheckedCreateInput = {
      userId: data.userId,
      strategyInstanceId: data.strategyInstanceId,
      status: data.status ?? 'active',
      customParams: data.customParams,
      exchangeAccountId: data.exchangeAccountId,
    }

    return this.txHost.tx.userStrategySubscription.create({
      data: payload,
    })
  }

  async update(
    id: string,
    data: Partial<{
      status: SubscriptionStatus
      customParams: Prisma.InputJsonValue | null
      exchangeAccountId: string | null
      unsubscribedAt: Date | null
    }>,
  ) {
    const payload: Prisma.UserStrategySubscriptionUncheckedUpdateInput = {}

    if (data.status !== undefined) {
      payload.status = data.status
    }
    if (data.customParams !== undefined) {
      payload.customParams = data.customParams
    }
    if (data.exchangeAccountId !== undefined) {
      payload.exchangeAccountId = data.exchangeAccountId
    }
    if (data.unsubscribedAt !== undefined) {
      payload.unsubscribedAt = data.unsubscribedAt
    }

    return this.txHost.tx.userStrategySubscription.update({
      where: { id },
      data: payload,
    })
  }

  async findStrategyInstanceForSubscribe(strategyInstanceId: string) {
    return this.txHost.tx.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        mode: true,
        strategyTemplate: {
          select: {
            id: true,
            name: true,
            status: true,
            requiredFields: true,
            paramsSchema: true,
          },
        },
      },
    })
  }

  async findExchangeAccountOwnership(exchangeAccountId: string, userId: string) {
    return this.txHost.tx.exchangeAccount.findFirst({
      where: { id: exchangeAccountId, userId },
      select: { id: true },
    })
  }
}
