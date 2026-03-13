/* eslint-disable ts/consistent-type-imports -- PrismaService 闇€瑕佽繍琛屾椂瀵煎叆浠ヤ緵 Nest 娉ㄥ叆 */
import type { Prisma, SubscriptionStatus } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client() {
    return this.prisma.getClient()
  }

  async findByUserAndStrategy(userId: string, strategyInstanceId: string) {
    return this.client.userStrategySubscription.findFirst({
      where: {
        userId,
        strategyInstanceId,
      },
    })
  }

  async findById(id: string) {
    return this.client.userStrategySubscription.findUnique({
      where: { id },
    })
  }

  async findByIdWithDetails(id: string) {
    return this.client.userStrategySubscription.findUnique({
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
   * 鏌ヨ璁㈤槄鍙婂叾鏍￠獙鎵€闇€鐨勬暟鎹紙鐢ㄤ簬鍙傛暟鏍￠獙鍦烘櫙锛?
   */
  async findByIdWithValidationData(id: string) {
    return this.client.userStrategySubscription.findUnique({
      where: { id },
      include: {
        strategyInstance: {
          select: {
            id: true,
            status: true,
            mode: true, // 馃敶 鏂板锛氶€夊嚭 mode 瀛楁鐢ㄤ簬鎭㈠璁㈤槄鏃剁殑鏍￠獙
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
      this.client.userStrategySubscription.findMany({
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
      this.client.userStrategySubscription.count({ where }),
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

    return this.client.userStrategySubscription.create({
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

    return this.client.userStrategySubscription.update({
      where: { id },
      data: payload,
    })
  }
}
