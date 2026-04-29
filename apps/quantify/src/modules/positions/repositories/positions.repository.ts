import type { PositionSide } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ExchangeId } from '@/modules/trading/core/types'
import type { Position, PrismaClient, Prisma, Trade } from '@/prisma/prisma.types'
import { PositionStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

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
              id: true,
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
              id: true,
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

  findAccountById(accountId: string) {
    return this.txHost.tx.userStrategyAccount.findUnique({
      where: { id: accountId },
    })
  }

  findTradeByExternalTradeId(accountId: string, externalTradeId: string) {
    return this.txHost.tx.trade.findFirst({
      where: {
        userStrategyAccountId: accountId,
        externalTradeId,
      },
    })
  }

  lockOpenPosition(accountId: string, normalizedSymbol: string, positionSide: PositionSide) {
    return this.txHost.tx.$queryRaw<Position[]>`
      SELECT
        "id",
        "user_strategy_account_id" AS "userStrategyAccountId",
        "symbol",
        "position_side" AS "positionSide",
        "leverage",
        "quantity",
        "avg_entry_price" AS "avgEntryPrice",
        "realized_pnl" AS "realizedPnl",
        "unrealized_pnl" AS "unrealizedPnl",
        "status",
        "opened_at" AS "openedAt",
        "closed_at" AS "closedAt",
        "exchange_id" AS "exchangeId",
        "market_type" AS "marketType",
        "metadata",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "positions"
      WHERE "user_strategy_account_id" = ${accountId}
        AND "symbol" = ${normalizedSymbol}
        AND "position_side" = ${positionSide}
        AND "status" = ${PositionStatus.OPEN}
      FOR UPDATE
    `
  }

  createPosition(data: Prisma.PositionUncheckedCreateInput) {
    return this.txHost.tx.position.create({ data })
  }

  updatePosition(id: string, data: Prisma.PositionUncheckedUpdateInput) {
    return this.txHost.tx.position.update({
      where: { id },
      data,
    })
  }

  createTrade(data: Prisma.TradeUncheckedCreateInput): Promise<Trade> {
    return this.txHost.tx.trade.create({ data })
  }

  aggregateOpenPositionUnrealizedPnl(accountId: string) {
    return this.txHost.tx.position.aggregate({
      where: { userStrategyAccountId: accountId, status: PositionStatus.OPEN },
      _sum: { unrealizedPnl: true },
    }).then(result => result._sum.unrealizedPnl)
  }

  refreshAccountEquityFromBalance(accountId: string, totalUnrealized: Prisma.Decimal) {
    return this.txHost.tx.$executeRaw`
      UPDATE "user_strategy_accounts"
      SET "total_unrealized_pnl" = ${totalUnrealized},
          "equity" = "balance" + ${totalUnrealized},
          "updated_at" = NOW()
      WHERE "id" = ${accountId}
    `
  }

  findOpenPositionsBySymbols(symbols: string[]) {
    return this.txHost.tx.position.findMany({
      where: {
        status: PositionStatus.OPEN,
        symbol: { in: symbols },
      },
    })
  }

  updatePositionUnrealizedPnl(positionId: string, unrealizedPnl: Prisma.Decimal) {
    return this.txHost.tx.position.update({
      where: { id: positionId },
      data: { unrealizedPnl },
    })
  }

  findAccountBalance(accountId: string) {
    return this.txHost.tx.userStrategyAccount.findUnique({
      where: { id: accountId },
      select: { balance: true },
    }).then(account => account?.balance ?? null)
  }

  updateAccountValuation(accountId: string, totalUnrealizedPnl: Prisma.Decimal, equity: Prisma.Decimal) {
    return this.txHost.tx.userStrategyAccount.update({
      where: { id: accountId },
      data: {
        totalUnrealizedPnl,
        equity,
      },
    })
  }

}
