import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, StrategyPnlDaily, UserStrategyAccount, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AccountsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

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
    const client = this.txHost.tx
    return client.userStrategyAccount.create({ data })
  }

  async findMany(params: {
    where: Prisma.UserStrategyAccountWhereInput
    orderBy?: Prisma.UserStrategyAccountOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<UserStrategyAccount[]> {
    const client = this.txHost.tx
    return client.userStrategyAccount.findMany(params)
  }

  async count(where: Prisma.UserStrategyAccountWhereInput): Promise<number> {
    const client = this.txHost.tx
    return client.userStrategyAccount.count({ where })
  }

  async findById(id: string): Promise<UserStrategyAccount | null> {
    const client = this.txHost.tx
    return client.userStrategyAccount.findUnique({ where: { id } })
  }

  async findByIdSelect<T extends Prisma.UserStrategyAccountSelect>(
    id: string,
    select: T,
  ): Promise<Prisma.UserStrategyAccountGetPayload<{ select: T }> | null> {
    const client = this.txHost.tx
    return client.userStrategyAccount.findUnique({ where: { id }, select }) as Promise<Prisma.UserStrategyAccountGetPayload<{ select: T }> | null>
  }

  async countAll(): Promise<number> {
    const client = this.txHost.tx
    return client.userStrategyAccount.count()
  }

  async findLatestDailyStatForAccount(id: string): Promise<StrategyPnlDaily | null> {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findFirst({
      where: { userStrategyAccountId: id },
      orderBy: { date: 'desc' },
    })
  }

  async groupLatestDailyStats(accountIds: string[]) {
    const client = this.txHost.tx
    return client.strategyPnlDaily.groupBy({
      by: ['userStrategyAccountId'],
      _max: { date: true },
      where: { userStrategyAccountId: { in: accountIds } },
    })
  }

  async findDailyStatsByConditions(
    conditions: Array<{ userStrategyAccountId: string; date: Date }>,
  ): Promise<StrategyPnlDaily[]> {
    const client = this.txHost.tx
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
    const client = this.txHost.tx
    return client.strategyPnlDaily.findMany(params)
  }

  async countDailyStats(where: Prisma.StrategyPnlDailyWhereInput): Promise<number> {
    const client = this.txHost.tx
    return client.strategyPnlDaily.count({ where })
  }

  // --- ledger methods used within transaction client ---

  async findLedgerMany(params: {
    where: Prisma.PnlLedgerWhereInput
    orderBy?: Prisma.PnlLedgerOrderByWithRelationInput
    skip: number
    take: number
  }) {
    const client = this.txHost.tx
    return client.pnlLedger.findMany(params)
  }

  async countLedger(where: Prisma.PnlLedgerWhereInput): Promise<number> {
    const client = this.txHost.tx
    return client.pnlLedger.count({ where })
  }

  // --- transaction-scoped operations (use CLS transaction context) ---

  async findAccount(id: string): Promise<UserStrategyAccount | null> {
    return this.txHost.tx.userStrategyAccount.findUnique({ where: { id } })
  }

  async findLedgerFirst(where: Prisma.PnlLedgerWhereInput) {
    return this.txHost.tx.pnlLedger.findFirst({ where })
  }

  async updateAccount(
    id: string,
    data: Prisma.UserStrategyAccountUpdateInput,
  ): Promise<UserStrategyAccount> {
    return this.txHost.tx.userStrategyAccount.update({ where: { id }, data })
  }

  async createLedger(data: Prisma.PnlLedgerUncheckedCreateInput) {
    return this.txHost.tx.pnlLedger.create({ data })
  }
}
