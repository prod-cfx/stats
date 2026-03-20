import type { PrismaService } from '@/prisma/prisma.service'
import { Injectable } from '@nestjs/common'
import { SubscriptionStatus } from '@/prisma/prisma.types'

interface ListStrategiesQuery {
  userId: string
  page: number
  limit: number
  status?: 'running' | 'stopped' | 'draft'
}

@Injectable()
export class AccountStrategyViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listStrategiesForUser(query: ListStrategiesQuery) {
    const client = this.prisma.getClient()
    const skip = (query.page - 1) * query.limit

    const subscribedInstanceIds = (
      await client.userStrategySubscription.findMany({
        where: { userId: query.userId },
        select: { strategyInstanceId: true },
      })
    ).map(item => item.strategyInstanceId)

    const where = {
      OR: [
        { id: { in: subscribedInstanceIds.length > 0 ? subscribedInstanceIds : ['__none__'] } },
        { createdBy: query.userId },
      ],
      ...(this.buildStatusWhere(query.status)),
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        include: {
          strategyTemplate: {
            select: {
              id: true,
              defaultParams: true,
            },
          },
          subscriptions: {
            where: { userId: query.userId },
            select: {
              status: true,
              customParams: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      client.strategyInstance.count({ where }),
    ])

    return {
      total,
      page: query.page,
      limit: query.limit,
      items: items.map(item => {
        const userSub = item.subscriptions[0]
        const isSubscribed = !!userSub && userSub.status === SubscriptionStatus.active
        return {
          id: item.id,
          name: item.name,
          status: item.status,
          params: item.params as Record<string, unknown> | null,
          defaultParams: item.strategyTemplate?.defaultParams as Record<string, unknown> | null,
          customParams: userSub?.customParams as Record<string, unknown> | null,
          updatedAt: item.updatedAt,
          subscribed: isSubscribed,
        }
      }),
    }
  }

  async findStrategyForUser(userId: string, strategyInstanceId: string) {
    const client = this.prisma.getClient()
    return client.strategyInstance.findFirst({
      where: {
        id: strategyInstanceId,
        OR: [
          { createdBy: userId },
          { subscriptions: { some: { userId } } },
        ],
      },
      include: {
        strategyTemplate: {
          select: {
            id: true,
            defaultParams: true,
          },
        },
        subscriptions: {
          where: { userId },
          include: {
            exchangeAccount: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
  }

  async findUserStrategyAccount(userId: string, strategyId: string) {
    const client = this.prisma.getClient()
    return client.userStrategyAccount.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
    })
  }

  async loadEquitySeries(accountId: string, limit = 120) {
    const client = this.prisma.getClient()
    return client.strategyPnlDaily.findMany({
      where: { userStrategyAccountId: accountId },
      orderBy: { date: 'asc' },
      take: limit,
    })
  }

  async loadTradeStats(accountId: string) {
    const client = this.prisma.getClient()
    const [tradeCount, closedCount, winningCount] = await Promise.all([
      client.trade.count({ where: { userStrategyAccountId: accountId } }),
      client.position.count({
        where: { userStrategyAccountId: accountId, status: 'CLOSED' },
      }),
      client.position.count({
        where: {
          userStrategyAccountId: accountId,
          status: 'CLOSED',
          realizedPnl: { gt: 0 },
        },
      }),
    ])

    return {
      tradeCount,
      closedCount,
      winningCount,
    }
  }

  async loadTimeline(userId: string, strategyInstanceId: string, accountId?: string) {
    const client = this.prisma.getClient()

    const [instance, subscription, signalExecutions, trades] = await Promise.all([
      client.strategyInstance.findUnique({
        where: { id: strategyInstanceId },
        select: {
          createdAt: true,
          startedAt: true,
          stoppedAt: true,
          status: true,
        },
      }),
      client.userStrategySubscription.findFirst({
        where: { userId, strategyInstanceId },
        select: {
          subscribedAt: true,
          unsubscribedAt: true,
          status: true,
        },
      }),
      accountId
        ? client.userSignalExecution.findMany({
            where: { userId, userStrategyAccountId: accountId },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      accountId
        ? client.trade.findMany({
            where: { userStrategyAccountId: accountId },
            orderBy: { executedAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ])

    return {
      instance,
      subscription,
      signalExecutions,
      trades,
    }
  }

  private buildStatusWhere(status?: 'running' | 'stopped' | 'draft') {
    if (!status) return {}
    if (status === 'running') return { status: 'running' }
    if (status === 'draft') return { status: 'draft' }
    return { status: { in: ['stopped', 'paused'] } }
  }
}
