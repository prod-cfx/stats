import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, Prisma, PositionStatus, StrategyInstanceMode, StrategyInstanceStatus, SubscriptionStatus } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StrategyInstancesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(data: {
    strategyTemplateId: string
    name: string
    description?: string
    llmModel: string
    mode?: StrategyInstanceMode
    params?: Prisma.InputJsonValue
    metadata?: Prisma.InputJsonValue
    createdBy?: string
  }) {
    const client = this.txHost.tx
    return client.strategyInstance.create({
      data: {
        ...data,
        status: 'draft',
      },
    })
  }

  async findById(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findUnique({
      where: { id },
    })
  }

  async findByIdWithDetails(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
          },
        },
      },
    })
  }

  async findMany(params: {
    strategyTemplateId?: string
    status?: StrategyInstanceStatus
    mode?: StrategyInstanceMode
    llmModel?: string
    skip?: number
    take?: number
  }) {
    const client = this.txHost.tx

    const where: Prisma.StrategyInstanceWhereInput = {}

    if (params.strategyTemplateId) {
      where.strategyTemplateId = params.strategyTemplateId
    }

    if (params.status) {
      where.status = params.status
    }

    if (params.mode) {
      where.mode = params.mode
    }

    if (params.llmModel) {
      where.llmModel = params.llmModel
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          strategyTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      }),
      client.strategyInstance.count({ where }),
    ])

    return { items, total }
  }

  /**
   * 查询运行中的策略实例（用户端）
   * 只返回 status='running' 且关联的策略模板为 'live' 状态的实例
   * 防止泄露未发布策略（draft/testing/disabled）
   */
  async findRunningInstances(params: {
    strategyTemplateId?: string
    llmModel?: string
    skip?: number
    take?: number
  }) {
    const client = this.txHost.tx

    const where: Prisma.StrategyInstanceWhereInput = {
      status: 'running',
      mode: 'LIVE', // 只向用户展示实盘运行的实例
      // 只公开 live 状态模板下的实例，防止泄露未发布策略
      strategyTemplate: {
        status: 'live',
      },
    }

    if (params.strategyTemplateId) {
      where.strategyTemplateId = params.strategyTemplateId
    }

    if (params.llmModel) {
      where.llmModel = params.llmModel
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { startedAt: 'desc' },
        include: {
          strategyTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      }),
      client.strategyInstance.count({ where }),
    ])

    return { items, total }
  }

  async update(
    id: string,
    data: {
      name?: string
      description?: string
      llmModel?: string
      status?: StrategyInstanceStatus
      mode?: StrategyInstanceMode
      params?: Prisma.InputJsonValue | null
      metadata?: Prisma.InputJsonValue | null
      startedAt?: Date | null
      stoppedAt?: Date | null
      updatedBy?: string
    },
  ) {
    const client = this.txHost.tx
    return client.strategyInstance.update({
      where: { id },
      data,
    })
  }

  async delete(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.delete({
      where: { id },
    })
  }

  async existsByTemplateModelName(
    strategyTemplateId: string,
    llmModel: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const client = this.txHost.tx
    const where: Prisma.StrategyInstanceWhereInput = {
      strategyTemplateId,
      llmModel,
      name,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const count = await client.strategyInstance.count({ where })
    return count > 0
  }

  async findTemplateById(id: string) {
    const client = this.txHost.tx
    return client.strategyTemplate.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
  }

  // ── Stats queries ────────────────────────────────────────────────────────────

  async findByIdWithTemplate(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: {
          select: { id: true },
        },
      },
    })
  }

  async findManyWithTemplate(ids: string[]) {
    const client = this.txHost.tx
    return client.strategyInstance.findMany({
      where: { id: { in: ids } },
      include: {
        strategyTemplate: {
          select: { id: true },
        },
      },
    })
  }

  async findActiveSubscriptionsByInstanceId(strategyInstanceId: string) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findMany({
      where: { strategyInstanceId, status: 'active' },
      select: { userId: true },
    })
  }

  async findActiveSubscriptionsByInstanceIds(instanceIds: string[]) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findMany({
      where: { strategyInstanceId: { in: instanceIds }, status: 'active' },
      select: { strategyInstanceId: true, userId: true },
    })
  }

  async findAccountsByUserIdsAndTemplates(userIds: string[], templateIds: string[]) {
    const client = this.txHost.tx
    return client.userStrategyAccount.findMany({
      where: {
        userId: { in: userIds },
        strategyId: { in: templateIds },
      },
      select: {
        id: true,
        userId: true,
        strategyId: true,
        initialBalance: true,
        balance: true,
        equity: true,
        totalRealizedPnl: true,
        totalUnrealizedPnl: true,
      },
    })
  }

  async findAccountsByUserIdsAndTemplate(userIds: string[], strategyTemplateId: string) {
    const client = this.txHost.tx
    return client.userStrategyAccount.findMany({
      where: {
        userId: { in: userIds },
        strategyId: strategyTemplateId,
      },
      select: {
        id: true,
        initialBalance: true,
        balance: true,
        equity: true,
        totalRealizedPnl: true,
        totalUnrealizedPnl: true,
      },
    })
  }

  async countPositionsByAccountIds(accountIds: string[], status: PositionStatus) {
    const client = this.txHost.tx
    return client.position.count({
      where: { userStrategyAccountId: { in: accountIds }, status },
    })
  }

  async findClosedPositionsByAccountIds(accountIds: string[]) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: { userStrategyAccountId: { in: accountIds }, status: 'CLOSED' },
      select: { realizedPnl: true },
    })
  }

  async findTodayPnlMetrics(accountIds: string[], todayStart: Date) {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findMany({
      where: {
        userStrategyAccountId: { in: accountIds },
        date: { gte: todayStart },
      },
      select: { realizedPnl: true, unrealizedPnl: true },
    })
  }

  async findTodayPnlMetricsBatch(accountIds: string[], todayStart: Date) {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findMany({
      where: {
        userStrategyAccountId: { in: accountIds },
        date: { gte: todayStart },
      },
      select: { userStrategyAccountId: true, realizedPnl: true, unrealizedPnl: true },
    })
  }

  async findPositionsByAccountIds(accountIds: string[]) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: { userStrategyAccountId: { in: accountIds } },
      select: { userStrategyAccountId: true, status: true },
    })
  }

  async findClosedPositionsWithPnlByAccountIds(accountIds: string[]) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: { userStrategyAccountId: { in: accountIds }, status: 'CLOSED' },
      select: { userStrategyAccountId: true, realizedPnl: true },
    })
  }

  // ── Subscription details queries ─────────────────────────────────────────────

  async findInstanceWithTemplateFull(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
          },
        },
      },
    })
  }

  async countSubscriptionsByInstance(strategyInstanceId: string) {
    const client = this.txHost.tx
    return client.userStrategySubscription.count({ where: { strategyInstanceId } })
  }

  async groupSubscriptionsByStatus(strategyInstanceId: string) {
    const client = this.txHost.tx
    return client.userStrategySubscription.groupBy({
      by: ['status'],
      where: { strategyInstanceId },
      _count: true,
    })
  }

  async findSubscriptionsWithUsers(strategyInstanceId: string, skip: number, take: number) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findMany({
      where: { strategyInstanceId },
      include: {
        user: {
          select: { id: true, nickname: true, email: true },
        },
        exchangeAccount: {
          select: { id: true, exchangeId: true, name: true },
        },
      },
      orderBy: { subscribedAt: 'desc' },
      skip,
      take,
    })
  }

  async aggregateAccountBalance(strategyInstanceId: string, strategyTemplateId: string, activeStatuses: SubscriptionStatus[]) {
    const client = this.txHost.tx
    return client.userStrategyAccount.aggregate({
      where: {
        strategyId: strategyTemplateId,
        user: {
          strategySubscriptions: {
            some: {
              strategyInstanceId,
              status: { in: activeStatuses },
            },
          },
        },
      },
      _sum: { initialBalance: true },
    })
  }

  async queryPositionAggregateRaw(strategyTemplateId: string, strategyInstanceId: string) {
    const client = this.txHost.tx
    return client.$queryRaw<Array<{ totalPositions: bigint; totalValue: any }>>`
      SELECT
        COALESCE(COUNT(*), 0) as "totalPositions",
        COALESCE(SUM(p.quantity * p.avg_entry_price), 0) as "totalValue"
      FROM positions p
      INNER JOIN user_strategy_accounts usa ON p.user_strategy_account_id = usa.id
      INNER JOIN user_strategy_subscriptions uss ON usa.user_id = uss.user_id
      WHERE usa.strategy_id = ${strategyTemplateId}
        AND uss.strategy_instance_id = ${strategyInstanceId}
        AND uss.status = ANY(ARRAY['active', 'paused']::"SubscriptionStatus"[])
        AND p.status = 'OPEN'
    `
  }

  async findPageAccountsByUserIds(userIds: string[], strategyTemplateId: string) {
    const client = this.txHost.tx
    return client.userStrategyAccount.findMany({
      where: {
        userId: { in: userIds },
        strategyId: strategyTemplateId,
      },
      select: { id: true, userId: true, initialBalance: true },
    })
  }

  async findOpenPositionsByAccountIds(accountIds: string[]) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: { userStrategyAccountId: { in: accountIds }, status: 'OPEN' },
      select: { userStrategyAccountId: true, quantity: true, avgEntryPrice: true },
    })
  }

  async findInstanceWithStrategyTemplate(id: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findUnique({
      where: { id },
      include: { strategyTemplate: true },
    })
  }

  async findSymbolsByCodes(codes: string[]) {
    const client = this.txHost.tx
    return client.symbol.findMany({
      where: { code: { in: codes } },
    })
  }

  async findActiveUserSubscription(userId: string, strategyInstanceId: string, status: SubscriptionStatus) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findFirst({
      where: { userId, strategyInstanceId, status },
      select: { id: true },
    })
  }

  async findActiveUserSubscriptionFull(userId: string, strategyInstanceId: string, status: SubscriptionStatus) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findMany({
      where: {
        userId,
        strategyInstanceId: { in: [strategyInstanceId] },
        status,
      },
      select: { strategyInstanceId: true },
    })
  }

  async findUserSubscriptionsByInstanceIds(userId: string, instanceIds: string[], status: SubscriptionStatus) {
    const client = this.txHost.tx
    return client.userStrategySubscription.findMany({
      where: { userId, strategyInstanceId: { in: instanceIds }, status },
      select: { strategyInstanceId: true },
    })
  }
}
