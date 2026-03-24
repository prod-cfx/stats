import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ExchangeId } from '@/modules/trading/core/types'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { PositionStatus } from '@/prisma/prisma.types'

@Injectable()
export class PositionsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findOpenByAccount(accountId: string) {
    return this.txHost.tx.position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: PositionStatus.OPEN,
      },
    })
  }

  async findUniqueWithAccount(positionId: string) {
    return this.txHost.tx.position.findUnique({
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
      this.txHost.tx.position.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.txHost.tx.position.count({ where }),
    ])
  }

  async findUserStrategyAccount(userId: string, strategyId: string) {
    return this.txHost.tx.userStrategyAccount.findUnique({
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
    return this.txHost.tx.position.findFirst({
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
      this.txHost.tx.userStrategySubscription.findMany({
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
      this.txHost.tx.userLlmStrategySubscription.findMany({
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
    return this.txHost.tx.positionSyncLog.create({ data })
  }

  async findUserStrategyAccountById(accountId: string) {
    return this.txHost.tx.userStrategyAccount.findUnique({
      where: { id: accountId },
      select: { userId: true, id: true },
    })
  }

}
