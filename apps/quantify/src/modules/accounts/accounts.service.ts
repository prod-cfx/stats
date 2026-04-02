import type { CreateStrategyAccountDto } from './dto/create-strategy-account.dto'
import type { LedgerEntryResponseDto } from './dto/ledger-entry.response.dto'
import type { LedgerQueryDto } from './dto/ledger-query.dto'
import type { MutateBalanceDto } from './dto/mutate-balance.dto'
import type { StrategyAccountListQueryDto } from './dto/strategy-account-list-query.dto'
import type { StrategyAccountResponseDto } from './dto/strategy-account.response.dto'
import type { StrategyPnlDailyQueryDto } from './dto/strategy-pnl-daily-query.dto'
import type { StrategyPnlDailyResponseDto } from './dto/strategy-pnl-daily.response.dto'
import type { StrategyPnlDaily, UserStrategyAccount } from '@/prisma/prisma.types'
import { ErrorCode, LedgerEntryType, PositionStatus } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { Prisma } from '@/prisma/prisma.types'
import { InsufficientBalanceException } from './exceptions/insufficient-balance.exception'
import { LedgerEntryConflictException } from './exceptions/ledger-entry-conflict.exception'
import { StrategyAccountConflictException } from './exceptions/strategy-account-conflict.exception'
import { StrategyAccountNotFoundException } from './exceptions/strategy-account-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AccountsRepository } from './repositories/accounts.repository'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal

type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

interface ListAccountsParams extends StrategyAccountListQueryDto {
  ownerUserId?: string
}

interface ApplyLedgerDeltaParams {
  accountId: string
  delta: Decimal
  ledgerType: LedgerEntryType
  positionId?: string
  referenceId?: string
  description?: string
  requireSufficientBalance?: boolean
  /**
   * 业务发生时间（用于日级报表聚合），未提供时默认为当前时间
   */
  occurredAt?: Date
}

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  async createUserStrategyAccount(userId: string, dto: CreateStrategyAccountDto) {
    const initialBalance = new Decimal(dto.initialBalance)
    try {
      const account = await this.accountsRepository.create({
        userId,
        strategyId: dto.strategyId,
        strategyName: dto.strategyName,
        strategyVersion: dto.strategyVersion,
        baseCurrency: dto.baseCurrency,
        initialBalance,
        balance: initialBalance,
        equity: initialBalance,
      })
      return this.toAccountResponse(account)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StrategyAccountConflictException({ userId, strategyId: dto.strategyId })
      }
      throw error
    }
  }

  async listAccounts(query: ListAccountsParams) {
    const { ownerUserId, limit, page, strategyId, keyword, baseCurrency, onlyActive } = query
    const where: Prisma.UserStrategyAccountWhereInput = {}
    if (ownerUserId) where.userId = ownerUserId
    if (strategyId) where.strategyId = strategyId
    if (baseCurrency) where.baseCurrency = baseCurrency
    if (keyword) {
      where.OR = [
        { strategyName: { contains: keyword, mode: 'insensitive' } },
        { strategyId: { contains: keyword, mode: 'insensitive' } },
      ]
    }
    if (onlyActive) {
      where.positions = {
        some: {
          status: PositionStatus.OPEN,
        },
      }
    }

    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.accountsRepository.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.accountsRepository.count(where),
    ])

    let latestStatMap: Map<string, StrategyPnlDaily> | undefined
    if (query.withDailyStats) {
      latestStatMap = await this.loadLatestDailyStats(items.map(item => item.id))
    }

    const data = items.map(account =>
      this.toAccountResponse(account, latestStatMap?.get(account.id)),
    )

    return new BasePaginationResponseDto<StrategyAccountResponseDto>(total, page, limit, data)
  }

  async getAccountDetail(id: string, options?: { includeLatestDaily?: boolean }) {
    const account = await this.accountsRepository.findById(id)
    if (!account) throw new StrategyAccountNotFoundException({ accountId: id })
    let latestDaily: StrategyPnlDaily | undefined
    if (options?.includeLatestDaily) {
      latestDaily = (await this.accountsRepository.findLatestDailyStatForAccount(id)) ?? undefined
    }
    return this.toAccountResponse(account, latestDaily)
  }

  async deposit(accountId: string, dto: MutateBalanceDto) {
    return this.mutateBalance(accountId, dto, LedgerEntryType.DEPOSIT)
  }

  async withdraw(accountId: string, dto: MutateBalanceDto) {
    return this.mutateBalance(accountId, dto, LedgerEntryType.WITHDRAW)
  }

  async listLedger(accountId: string, query: LedgerQueryDto) {
    await this.ensureAccountExists(accountId)
    const where: Prisma.PnlLedgerWhereInput = {
      userStrategyAccountId: accountId,
    }
    if (query.type) where.type = query.type
    if (query.start || query.end) {
      where.occurredAt = {}
      if (query.start) where.occurredAt.gte = new Date(query.start)
      if (query.end) where.occurredAt.lte = new Date(query.end)
    }
    if (query.includeSystemOnly) {
      where.referenceId = {
        not: null,
      }
    }

    // 确保分页参数有效
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      this.accountsRepository.findLedgerMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.accountsRepository.countLedger(where),
    ])

    const data: LedgerEntryResponseDto[] = items.map(entry => ({
      id: entry.id,
      userStrategyAccountId: entry.userStrategyAccountId,
      positionId: entry.positionId,
      type: entry.type,
      amount: entry.amount.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      referenceId: entry.referenceId,
      description: entry.description,
      occurredAt: entry.occurredAt.toISOString(),
      meta: entry.meta as Record<string, unknown> | null,
    }))

    return new BasePaginationResponseDto<LedgerEntryResponseDto>(total, page, limit, data)
  }

  async listDailyStats(accountId: string, query: StrategyPnlDailyQueryDto) {
    await this.ensureAccountExists(accountId)
    const where: Prisma.StrategyPnlDailyWhereInput = { userStrategyAccountId: accountId }
    if (query.lastDays) {
      const start = new Date(Date.now() - query.lastDays * 24 * 60 * 60 * 1000)
      where.date = { gte: start }
    }

    // 确保分页参数有效
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      this.accountsRepository.findManyDailyStats({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.accountsRepository.countDailyStats(where),
    ])

    const data: StrategyPnlDailyResponseDto[] = items.map(item => ({
      id: item.id,
      userStrategyAccountId: item.userStrategyAccountId,
      date: item.date.toISOString(),
      equityStart: item.equityStart.toString(),
      equityEnd: item.equityEnd.toString(),
      realizedPnl: item.realizedPnl.toString(),
      unrealizedPnl: item.unrealizedPnl.toString(),
      deposits: item.deposits.toString(),
      withdrawals: item.withdrawals.toString(),
      maxDrawdown: item.maxDrawdown.toString(),
    }))

    return new BasePaginationResponseDto<StrategyPnlDailyResponseDto>(
      total,
      page,
      limit,
      data,
    )
  }

  private async ensureAccountExists(accountId: string) {
    const exists = await this.accountsRepository.findByIdSelect(accountId, { id: true })
    if (!exists) {
      throw new StrategyAccountNotFoundException({ accountId })
    }
  }

  async getAccountOwner(accountId: string) {
    const account = await this.accountsRepository.findByIdSelect(accountId, {
      id: true,
      userId: true,
    })
    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId })
    }
    return account
  }

  private async mutateBalance(accountId: string, dto: MutateBalanceDto, type: LedgerEntryType) {
    const amount = new Decimal(dto.amount)
    if (amount.lte(0)) {
      throw new DomainException('Amount must be greater than 0', {
        code: ErrorCode.BAD_REQUEST,
        args: { amount: dto.amount },
      })
    }

    const delta = type === LedgerEntryType.WITHDRAW ? amount.neg() : amount
    const updated = await this.applyLedgerDelta({
      accountId,
      delta,
      ledgerType: type,
      referenceId: dto.referenceId,
      description: dto.description,
      requireSufficientBalance: type === LedgerEntryType.WITHDRAW,
    })

    return this.toAccountResponse(updated)
  }

  async applyRealizedPnlDelta(
    accountId: string,
    amount: Decimal,
    options?: { positionId?: string; referenceId?: string; description?: string; occurredAt?: Date },
  ) {
    if (amount.isZero()) return
    await this.applyLedgerDelta({
      accountId,
      delta: amount,
      ledgerType: LedgerEntryType.REALIZED_PNL,
      positionId: options?.positionId,
      referenceId: options?.referenceId,
      description: options?.description,
      occurredAt: options?.occurredAt,
    })
  }

  async recordFee(
    accountId: string,
    fee: Decimal,
    options?: { positionId?: string; referenceId?: string; description?: string; occurredAt?: Date },
  ) {
    if (fee.lte(0)) return
    await this.applyLedgerDelta({
      accountId,
      delta: fee.neg(),
      ledgerType: LedgerEntryType.FEE,
      positionId: options?.positionId,
      referenceId: options?.referenceId,
      description: options?.description,
      occurredAt: options?.occurredAt,
    })
  }

  private async loadLatestDailyStats(accountIds: string[]) {
    if (!accountIds.length) return new Map<string, StrategyPnlDaily>()
    const grouped = await this.accountsRepository.groupLatestDailyStats(accountIds)
    const conditions = grouped
      .filter(item => item._max.date)
      .map(item => ({
        userStrategyAccountId: item.userStrategyAccountId,
        date: item._max.date!,
      }))
    if (!conditions.length) return new Map<string, StrategyPnlDaily>()
    const latest = await this.accountsRepository.findDailyStatsByConditions(conditions)
    return new Map(latest.map(item => [item.userStrategyAccountId, item]))
  }

  async applyLedgerDelta(params: ApplyLedgerDeltaParams): Promise<UserStrategyAccount> {
    const {
      accountId,
      delta,
      ledgerType,
      positionId,
      referenceId,
      description,
      requireSufficientBalance,
      occurredAt,
    } = params

    const account = await this.accountsRepository.findAccount(accountId)
    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId })
    }

    if (referenceId) {
      const existing = await this.accountsRepository.findLedgerFirst({
        userStrategyAccountId: accountId,
        referenceId,
      })
      if (existing) {
        throw new LedgerEntryConflictException({ referenceId })
      }
    }

    // 使用原子递增避免 lost update，并在更新后检查余额是否为负，依赖事务回滚保证资金安全
    const updatedAccount = await this.accountsRepository.updateAccount(accountId, {
      balance: { increment: delta },
      equity: { increment: delta },
      ...(ledgerType === LedgerEntryType.REALIZED_PNL
        ? { totalRealizedPnl: { increment: delta } }
        : {}),
    })

    if (requireSufficientBalance && updatedAccount.balance.lt(0)) {
      // 事务中抛出异常会导致本次账户更新与后续 ledger 写入一并回滚
      throw new InsufficientBalanceException({
        accountId,
        required: delta.abs().toString(),
        available: updatedAccount.balance.add(delta.neg()).toString(),
      })
    }

    await this.accountsRepository.createLedger({
      userStrategyAccountId: accountId,
      positionId,
      type: ledgerType,
      amount: delta,
      balanceAfter: updatedAccount.balance,
      referenceId,
      description,
      occurredAt: occurredAt ?? new Date(),
    })

    return updatedAccount
  }

  private toAccountResponse(
    account: UserStrategyAccount,
    latestDaily?: StrategyPnlDaily,
  ): StrategyAccountResponseDto {
    return {
      id: account.id,
      userId: account.userId,
      strategyId: account.strategyId,
      strategyName: account.strategyName ?? null,
      strategyVersion: account.strategyVersion ?? null,
      baseCurrency: account.baseCurrency,
      initialBalance: account.initialBalance.toString(),
      balance: account.balance.toString(),
      equity: account.equity.toString(),
      totalRealizedPnl: account.totalRealizedPnl?.toString() ?? '0',
      totalUnrealizedPnl: account.totalUnrealizedPnl?.toString() ?? '0',
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      latestDailyStat: latestDaily
        ? {
            date: latestDaily.date.toISOString(),
            equityEnd: latestDaily.equityEnd.toString(),
            realizedPnl: latestDaily.realizedPnl.toString(),
            unrealizedPnl: latestDaily.unrealizedPnl.toString(),
          }
        : null,
    }
  }
}
