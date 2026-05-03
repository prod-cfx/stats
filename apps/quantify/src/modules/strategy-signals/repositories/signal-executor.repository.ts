import type { PositionSide, SignalStatus, QuantifyInstrumentType as InstrumentType } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SignalExecutorRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findRecoverableSignals(input: { limit: number; readyBefore: Date }) {
    const now = new Date()
    return this.txHost.tx.tradingSignal.findMany({
      where: {
        status: 'PENDING' satisfies SignalStatus,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        createdAt: { lte: input.readyBefore },
        executions: {
          none: {},
        },
      },
      orderBy: { createdAt: 'asc' },
      take: input.limit,
    })
  }

  findSubscribedAccounts(where: Prisma.UserStrategyAccountWhereInput, take: number) {
    return this.txHost.tx.userStrategyAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
    })
  }

  findActiveLlmSubscription(userId: string, llmStrategyInstanceId: string) {
    return this.txHost.tx.userLlmStrategySubscription.findFirst({
      where: {
        userId,
        llmStrategyInstanceId,
        status: 'active',
      },
      select: {
        exchangeAccountId: true,
        exchangeAccount: { select: { exchangeId: true } },
      },
    })
  }

  findSymbolForCrossExchange(params: {
    exchange: string
    baseAsset: string
    quoteAsset: string
    instrumentType: InstrumentType
  }) {
    return this.txHost.tx.symbol.findFirst({
      where: {
        exchange: params.exchange,
        baseAsset: params.baseAsset,
        quoteAsset: params.quoteAsset,
        instrumentType: params.instrumentType,
        status: 'ACTIVE',
      },
    })
  }

  findRiskProfileByStrategyInstanceId(strategyInstanceId: string) {
    return this.txHost.tx.strategyInstanceRiskProfile.findUnique({
      where: { strategyInstanceId },
    })
  }

  findStrategyInstanceMode(strategyInstanceId: string) {
    return this.txHost.tx.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { mode: true, deploymentExecutionConfig: true },
    })
  }

  findActiveSubscriptionNetwork(userId: string, strategyInstanceId: string) {
    return this.txHost.tx.userStrategySubscription.findFirst({
      where: {
        userId,
        strategyInstanceId,
        status: 'active',
      },
      select: {
        exchangeAccountId: true,
        exchangeAccount: {
          select: { isTestnet: true },
        },
      },
    })
  }

  async incrementStrategyExecutionFailure(strategyInstanceId: string) {
    return this.txHost.tx.strategyInstanceSafetyState.upsert({
      where: { strategyInstanceId },
      create: {
        strategyInstanceId,
        consecutiveExecutionFailures: 1,
        lastFailureAt: new Date(),
      },
      update: {
        consecutiveExecutionFailures: { increment: 1 },
        lastFailureAt: new Date(),
      },
      select: {
        strategyInstanceId: true,
        consecutiveExecutionFailures: true,
      },
    })
  }

  async resetStrategyExecutionFailure(strategyInstanceId: string) {
    return this.txHost.tx.strategyInstanceSafetyState.upsert({
      where: { strategyInstanceId },
      create: {
        strategyInstanceId,
        consecutiveExecutionFailures: 0,
      },
      update: {
        consecutiveExecutionFailures: 0,
        autoStoppedAt: null,
        autoStopReason: null,
      },
    })
  }

  async markStrategyAutoStopped(strategyInstanceId: string, reason: string) {
    return this.txHost.tx.strategyInstanceSafetyState.upsert({
      where: { strategyInstanceId },
      create: {
        strategyInstanceId,
        consecutiveExecutionFailures: 3,
        autoStoppedAt: new Date(),
        autoStopReason: reason,
      },
      update: {
        autoStoppedAt: new Date(),
        autoStopReason: reason,
      },
    })
  }

  findOpenPositionForClose(input: {
    accountId: string
    exchangeId: ExchangeId
    marketType: MarketType
    symbol: string
    positionSide: PositionSide
  }) {
    return this.txHost.tx.position.findFirst({
      where: {
        userStrategyAccountId: input.accountId,
        exchangeId: input.exchangeId,
        marketType: input.marketType,
        symbol: input.symbol,
        status: 'OPEN',
        positionSide: input.positionSide,
      },
      orderBy: { openedAt: 'desc' },
    })
  }

  findOpenPositionsForAdmission(input: {
    accountId: string
    exchangeId: ExchangeId
    marketType: MarketType
    symbol: string
  }) {
    return this.txHost.tx.position.findMany({
      where: {
        userStrategyAccountId: input.accountId,
        exchangeId: input.exchangeId,
        marketType: input.marketType,
        symbol: input.symbol,
        status: 'OPEN',
      },
      select: {
        positionSide: true,
        quantity: true,
      },
    })
  }

  async hasPendingReconcileRequiredEntryExecution(accountId: string): Promise<boolean> {
    const count = await this.txHost.tx.userSignalExecution.count({
      where: {
        userStrategyAccountId: accountId,
        status: 'FAILED',
        orderSide: { in: ['BUY', 'SELL'] },
        signal: {
          signalType: 'ENTRY',
        },
        metadata: {
          path: ['reconcileRequired'],
          equals: true,
        },
      },
    })
    return count > 0
  }

  lockAccount(accountId: string) {
    return this.txHost.tx.$queryRaw<
      Array<{
        id: string
        userId: string
        baseCurrency: string
        balance: Prisma.Decimal
        equity: Prisma.Decimal
        initialBalance: Prisma.Decimal
      }>
    >`
      SELECT
        "id",
        "user_id" AS "userId",
        "base_currency" AS "baseCurrency",
        "balance",
        "equity",
        "initial_balance" AS "initialBalance"
      FROM "user_strategy_accounts"
      WHERE "id" = ${accountId}
      FOR UPDATE
    `
  }
}
