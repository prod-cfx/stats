import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { LedgerEntryType } from '@ai/shared'
import type { PrismaClient, StrategyPnlDaily, UserStrategyAccount, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

type Decimal = Prisma.Decimal

export interface LedgerGroupResult {
  userStrategyAccountId: string
  type: LedgerEntryType
  _sum: { amount: Decimal | null }
}

@Injectable()
export class StrategyPnlReportRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async groupLedgerByAccountAndType(dayStart: Date, dayEnd: Date): Promise<LedgerGroupResult[]> {
    const client = this.txHost.tx
    const result = await client.pnlLedger.groupBy({
      by: ['userStrategyAccountId', 'type'],
      where: {
        occurredAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      _sum: { amount: true },
    })
    return result as unknown as LedgerGroupResult[]
  }

  async findDailyStatsByDate(date: Date): Promise<StrategyPnlDaily[]> {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findMany({ where: { date } })
  }

  async countAccounts(): Promise<number> {
    const client = this.txHost.tx
    return client.userStrategyAccount.count()
  }

  async findAccountsBatch(skip: number, take: number): Promise<UserStrategyAccount[]> {
    const client = this.txHost.tx
    return client.userStrategyAccount.findMany({ skip, take })
  }

  async upsertDailyStat(params: {
    userStrategyAccountId: string
    date: Date
    equityStart: Decimal
    equityEnd: Decimal
    realizedPnl: Decimal
    unrealizedPnl: Decimal | null
    deposits: Decimal
    withdrawals: Decimal
    maxDrawdown: Decimal
  }): Promise<void> {
    const client = this.txHost.tx
    const { userStrategyAccountId, date, ...rest } = params
    await client.strategyPnlDaily.upsert({
      where: {
        userStrategyAccountId_date: {
          userStrategyAccountId,
          date,
        },
      },
      create: {
        userStrategyAccountId,
        date,
        ...rest,
      },
      update: rest,
    })
  }
}
