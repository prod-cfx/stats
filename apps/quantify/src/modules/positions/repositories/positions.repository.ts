 
import type { ExchangeId } from '@/modules/trading/core/types'
import type { Prisma } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入
import { PrismaService } from '@/prisma/prisma.service'
import { PositionStatus } from '@/prisma/prisma.types'

@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findOpenByAccount(accountId: string) {
    return this.getClient().position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: PositionStatus.OPEN,
      },
    })
  }

  async findUniqueWithAccount(positionId: string) {
    return this.getClient().position.findUnique({
      where: { id: positionId },
      include: {
        account: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })
  }

  async findManyPaginated(where: Prisma.PositionWhereInput, skip: number, take: number) {
    return Promise.all([
      this.getClient().position.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.getClient().position.count({ where }),
    ])
  }

  async findUserStrategyAccount(userId: string, strategyId: string) {
    return this.getClient().userStrategyAccount.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
      select: { id: true },
    })
  }

  async findFirstPositionByAccount(accountId: string, exchangeId: ExchangeId) {
    return this.getClient().position.findFirst({
      where: {
        userStrategyAccountId: accountId,
        exchangeId,
        marketType: {
          in: ['spot', 'perp'],
        },
      },
      select: {
        marketType: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findActiveSubscriptionsForBatchSync(take: number) {
    return Promise.all([
      this.getClient().userStrategySubscription.findMany({
        where: {
          status: 'active',
          exchangeAccountId: { not: null },
        },
        select: {
          userId: true,
          strategyInstance: {
            select: {
              strategyTemplateId: true,
            },
          },
          exchangeAccount: {
            select: {
              exchangeId: true,
            },
          },
        },
        take,
      }),
      this.getClient().userLlmStrategySubscription.findMany({
        where: {
          status: 'active',
          exchangeAccountId: { not: null },
        },
        select: {
          userId: true,
          llmStrategyInstance: {
            select: {
              strategyId: true,
            },
          },
          exchangeAccount: {
            select: {
              exchangeId: true,
            },
          },
        },
        take,
      }),
    ])
  }

  async saveSyncLog(data: {
    userId: string
    userStrategyAccountId: string
    exchangeId: string
    marketType: string
    syncType: string
    success: boolean
    exchangePositions: number
    localPositions: number
    differencesCount: number
    differences: Prisma.JsonValue | null
    errors: Prisma.JsonValue | null
    durationMs: number
    triggeredBy?: string
  }) {
    return this.getClient().positionSyncLog.create({ data })
  }

  async findUserStrategyAccountById(accountId: string) {
    return this.getClient().userStrategyAccount.findUnique({
      where: { id: accountId },
      select: { userId: true, id: true },
    })
  }

  runInTransaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(fn)
  }
}
