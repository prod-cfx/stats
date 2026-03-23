import type { StrategyPnlDaily, UserStrategyAccount, Prisma  } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
 
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AccountsRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async create(data: {
    userId: string
    strategyId: string
    strategyName?: string
    strategyVersion?: string
    baseCurrency: string
    initialBalance: Prisma.Decimal
    balance: Prisma.Decimal
    equity: Prisma.Decimal
  }): Promise<UserStrategyAccount> {
    const client = this.getClient()
    return client.userStrategyAccount.create({ data })
  }

  async findMany(params: {
    where: Prisma.UserStrategyAccountWhereInput
    orderBy?: Prisma.UserStrategyAccountOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<UserStrategyAccount[]> {
    const client = this.getClient()
    return client.userStrategyAccount.findMany(params)
  }

  async count(where: Prisma.UserStrategyAccountWhereInput): Promise<number> {
    const client = this.getClient()
    return client.userStrategyAccount.count({ where })
  }

  async findById(id: string): Promise<UserStrategyAccount | null> {
    const client = this.getClient()
    return client.userStrategyAccount.findUnique({ where: { id } })
  }

  async findByIdSelect<T extends Prisma.UserStrategyAccountSelect>(
    id: string,
    select: T,
  ): Promise<Prisma.UserStrategyAccountGetPayload<{ select: T }> | null> {
    const client = this.getClient()
    return client.userStrategyAccount.findUnique({ where: { id }, select }) as Promise<Prisma.UserStrategyAccountGetPayload<{ select: T }> | null>
  }

  async countAll(): Promise<number> {
    const client = this.getClient()
    return client.userStrategyAccount.count()
  }

  async findLatestDailyStatForAccount(id: string): Promise<StrategyPnlDaily | null> {
    const client = this.getClient()
    return client.strategyPnlDaily.findFirst({
      where: { userStrategyAccountId: id },
      orderBy: { date: 'desc' },
    })
  }

  async groupLatestDailyStats(accountIds: string[]) {
    const client = this.getClient()
    return client.strategyPnlDaily.groupBy({
      by: ['userStrategyAccountId'],
      _max: { date: true },
      where: { userStrategyAccountId: { in: accountIds } },
    })
  }

  async findDailyStatsByConditions(
    conditions: Array<{ userStrategyAccountId: string; date: Date }>,
  ): Promise<StrategyPnlDaily[]> {
    const client = this.getClient()
    return client.strategyPnlDaily.findMany({
      where: { OR: conditions },
    })
  }

  async findManyDailyStats(params: {
    where: Prisma.StrategyPnlDailyWhereInput
    orderBy?: Prisma.StrategyPnlDailyOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<StrategyPnlDaily[]> {
    const client = this.getClient()
    return client.strategyPnlDaily.findMany(params)
  }

  async countDailyStats(where: Prisma.StrategyPnlDailyWhereInput): Promise<number> {
    const client = this.getClient()
    return client.strategyPnlDaily.count({ where })
  }

  async runInTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.runInTransaction(fn)
  }

  // --- ledger methods used within transaction client ---

  async findLedgerMany(params: {
    where: Prisma.PnlLedgerWhereInput
    orderBy?: Prisma.PnlLedgerOrderByWithRelationInput
    skip: number
    take: number
  }) {
    const client = this.getClient()
    return client.pnlLedger.findMany(params)
  }

  async countLedger(where: Prisma.PnlLedgerWhereInput): Promise<number> {
    const client = this.getClient()
    return client.pnlLedger.count({ where })
  }

  // --- transaction-scoped operations (accept TransactionClient) ---

  async findAccountInTx(
    prisma: Prisma.TransactionClient,
    id: string,
  ): Promise<UserStrategyAccount | null> {
    return prisma.userStrategyAccount.findUnique({ where: { id } })
  }

  async findLedgerFirstInTx(
    prisma: Prisma.TransactionClient,
    where: Prisma.PnlLedgerWhereInput,
  ) {
    return prisma.pnlLedger.findFirst({ where })
  }

  async updateAccountInTx(
    prisma: Prisma.TransactionClient,
    id: string,
    data: Prisma.UserStrategyAccountUpdateInput,
  ): Promise<UserStrategyAccount> {
    return prisma.userStrategyAccount.update({ where: { id }, data })
  }

  async createLedgerInTx(
    prisma: Prisma.TransactionClient,
    data: Prisma.PnlLedgerUncheckedCreateInput,
  ) {
    return prisma.pnlLedger.create({ data })
  }
}
