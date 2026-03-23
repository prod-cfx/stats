import type { Prisma } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { PrismaService } from '@/prisma/prisma.service'
import { SubscriptionStatus } from '@/prisma/prisma.types'

interface ListStrategiesQuery {
  userId: string
  page: number
  limit: number
  status?: 'running' | 'stopped' | 'draft'
}

interface DeployStrategyInput {
  userId: string
  name: string
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  timeframe: string
  positionPct: number
  exchangeAccountId?: string
  exchangeAccountName?: string
}

@Injectable()
export class AccountStrategyViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deployStrategyForUser(input: DeployStrategyInput): Promise<string> {
    const strategyInstanceId = await this.prisma.runInTransaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      })

      if (!existingUser) {
        await tx.user.create({
          data: {
            id: input.userId,
            email: `${input.userId}@local.quantify`,
            nickname: 'AI Quant User',
            isGuest: true,
          },
        })
      }

      let resolvedExchangeAccountId: string | undefined
      if (input.exchangeAccountId) {
        const matchedAccount = await tx.exchangeAccount.findFirst({
          where: {
            id: input.exchangeAccountId,
            userId: input.userId,
          },
          select: { id: true },
        })
        if (!matchedAccount) {
          throw new ExchangeAccountNotFoundException({ accountId: input.exchangeAccountId })
        }
        resolvedExchangeAccountId = matchedAccount.id
      }

      if (!resolvedExchangeAccountId) {
        const existingAccount = await tx.exchangeAccount.findFirst({
          where: {
            userId: input.userId,
            exchangeId: input.exchange,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true },
        })
        if (!existingAccount) {
          throw new ExchangeAccountNotFoundException({
            accountId: input.exchangeAccountId ?? `${input.exchange}-account`,
          })
        }
        resolvedExchangeAccountId = existingAccount.id
      }

      const templateName = `AI量化快捷模板-${input.userId}`
      const existingTemplate = await tx.strategyTemplate.findUnique({
        where: { name: templateName },
        select: { id: true },
      })
      const strategyTemplateId = existingTemplate?.id
        ?? (await tx.strategyTemplate.create({
            data: {
              name: templateName,
              description: '用于 AI 量化一键部署验证的自动模板',
              llmModel: 'gpt-4',
              promptTemplate: 'AUTO_DEPLOY_TEMPLATE',
              paramsSchema: {},
              defaultParams: {
                exchange: input.exchange,
                symbol: input.symbol,
                timeframe: input.timeframe,
                positionPct: input.positionPct,
              },
              requiredFields: [],
              status: 'live',
              createdBy: input.userId,
              updatedBy: input.userId,
              metadata: { source: 'account-ai-quant-deploy' },
            },
            select: { id: true },
          })).id

      const normalizedName = input.name.trim() || 'AI策略'
      const instanceName = `${normalizedName}-${Date.now()}`
      const params = {
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        positionPct: input.positionPct,
      }

      const strategyInstance = await tx.strategyInstance.create({
        data: {
          strategyTemplateId,
          name: instanceName,
          description: `一键部署 - ${input.symbol}`,
          llmModel: 'gpt-4',
          params,
          status: 'running',
          mode: 'TESTNET',
          startedAt: new Date(),
          createdBy: input.userId,
          updatedBy: input.userId,
          metadata: { source: 'account-ai-quant-deploy' },
        },
        select: { id: true },
      })

      await tx.userStrategySubscription.create({
        data: {
          userId: input.userId,
          strategyInstanceId: strategyInstance.id,
          status: 'active',
          customParams: params,
          exchangeAccountId: resolvedExchangeAccountId,
        },
      })

      return strategyInstance.id
    })

    return strategyInstanceId
  }

  async listStrategiesForUser(query: ListStrategiesQuery) {
    const client = this.prisma.getClient()
    const page = Number(query.page)
    const limit = Number(query.limit)
    const skip = (page - 1) * limit

    const subscribedInstanceIds = (
      await client.userStrategySubscription.findMany({
        where: { userId: query.userId },
        select: { strategyInstanceId: true },
      })
    ).map(item => item.strategyInstanceId)

    const where: Prisma.StrategyInstanceWhereInput = {
      OR: [
        { id: { in: subscribedInstanceIds.length > 0 ? subscribedInstanceIds : ['__none__'] } },
        { createdBy: query.userId },
      ],
      ...this.buildStatusWhere(query.status),
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
        take: limit,
      }),
      client.strategyInstance.count({ where }),
    ])

    return {
      total,
      page,
      limit,
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

  async findLatestExecutedAccountByUserAndSymbol(userId: string, symbol: string) {
    const client = this.prisma.getClient()
    const normalizedSymbol = symbol.trim().toUpperCase()

    const latestTrade = await client.trade.findFirst({
      where: {
        symbol: normalizedSymbol,
        account: {
          userId,
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      select: {
        account: {
          select: {
            id: true,
            initialBalance: true,
            equity: true,
            totalRealizedPnl: true,
            totalUnrealizedPnl: true,
          },
        },
      },
    })

    return latestTrade?.account ?? null
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

  async loadClosedPositionPnlSeries(accountId: string, limit = 500) {
    const client = this.prisma.getClient()
    return client.position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: 'CLOSED',
      },
      orderBy: {
        closedAt: 'asc',
      },
      take: limit,
      select: {
        openedAt: true,
        closedAt: true,
        realizedPnl: true,
      },
    })
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

  private buildStatusWhere(status?: 'running' | 'stopped' | 'draft'): Prisma.StrategyInstanceWhereInput {
    if (!status) return {}
    if (status === 'running') {
      return { status: 'running' }
    }
    if (status === 'draft') {
      return { status: 'draft' }
    }
    return { status: { in: ['stopped', 'paused'] } }
  }
}
