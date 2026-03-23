import type { StrategyPnlDaily, UserStrategyAccount, LedgerEntryType, Prisma  } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
 
import { PrismaService } from '@/prisma/prisma.service'

 
type Decimal = Prisma.Decimal
 

export interface LedgerGroupResult {
  userStrategyAccountId: string
  type: LedgerEntryType
  _sum: { amount: Decimal | null }
}

@Injectable()
export class StrategyPnlReportRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async groupLedgerByAccountAndType(dayStart: Date, dayEnd: Date): Promise<LedgerGroupResult[]> {
    const client = this.getClient()
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
    const client = this.getClient()
    return client.strategyPnlDaily.findMany({ where: { date } })
  }

  async countAccounts(): Promise<number> {
    const client = this.getClient()
    return client.userStrategyAccount.count()
  }

  async findAccountsBatch(skip: number, take: number): Promise<UserStrategyAccount[]> {
    const client = this.getClient()
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
    const client = this.getClient()
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
