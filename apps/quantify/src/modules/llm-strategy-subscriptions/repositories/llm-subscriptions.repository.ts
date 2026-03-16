import type { SubscriptionStatus } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest 娉ㄥ叆闇€瑕佽繍琛屾椂绫?
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class LlmSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndInstance(userId: string, llmStrategyInstanceId: string) {
    try {
      return await this.prisma.getClient().userLlmStrategySubscription.findFirst({
        where: { userId, llmStrategyInstanceId },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        // 鏈湴寮€鍙戠幆澧冭〃灏氭湭鍒涘缓鏃讹紝闄嶇骇涓烘棤璁㈤槄璁板綍
        return null
      }
      throw error
    }
  }

  async findById(id: string) {
    try {
      return await this.prisma.getClient().userLlmStrategySubscription.findUnique({
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
      return await this.prisma.getClient().userLlmStrategySubscription.findUnique({
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
    const client = this.prisma.getClient()

    const where: Prisma.UserLlmStrategySubscriptionWhereInput = {
      userId,
      ...(params.status ? { status: params.status } : {}),
    }

    try {
      const [items, total] = await Promise.all([
        client.userLlmStrategySubscription.findMany({
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
        client.userLlmStrategySubscription.count({ where }),
      ])

      return { items, total }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021' &&
        String(error.message).includes('user_llm_strategy_subscriptions')
      ) {
        // 鏈湴寮€鍙戞暟鎹簱娌℃湁琛ㄦ椂锛岃繑鍥炵┖鍒楄〃锛岄伩鍏?/llm-strategy-subscriptions 鐩存帴 500
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

    return this.prisma.getClient().userLlmStrategySubscription.create({ data: payload })
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

    return this.prisma.getClient().userLlmStrategySubscription.update({
      where: { id },
      data: payload,
    })
  }

  async delete(id: string) {
    return this.prisma.getClient().userLlmStrategySubscription.delete({
      where: { id },
    })
  }
}
