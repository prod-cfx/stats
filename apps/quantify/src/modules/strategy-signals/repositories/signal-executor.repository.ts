import type { ExecutionStatus, PositionSide, SignalStatus, QuantifyInstrumentType as InstrumentType } from '@ai/shared'
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
      select: { mode: true },
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

  /**
   * #1208 — Find sibling multi-leg signals from the same emit batch that have
   * an EXECUTED execution on the given account, so the executor can
   * market-close them when one leg fails (executor-stage saga compensate).
   *
   * Batch identity: same strategyInstance + same `executionSemanticKey` (written
   * into `metadata.runtimeProvenance.executionSemanticKey` by PR4a emit).
   *
   * Idempotency: callers must skip siblings whose execution already has
   * `metadata.sagaCompensated=true` before re-firing (recovery cron guard).
   */
  findExecutedMultiLegSiblings(input: {
    strategyInstanceId?: string | null
    llmStrategyInstanceId?: string | null
    executionSemanticKey: string
    excludeSignalId: string
    accountId: string
  }) {
    const instanceClause: Prisma.TradingSignalWhereInput = input.strategyInstanceId
      ? { strategyInstanceId: input.strategyInstanceId }
      : input.llmStrategyInstanceId
        ? { llmStrategyInstanceId: input.llmStrategyInstanceId }
        : { id: '__never__' }

    return this.txHost.tx.tradingSignal.findMany({
      where: {
        ...instanceClause,
        id: { not: input.excludeSignalId },
        metadata: {
          path: ['runtimeProvenance', 'executionSemanticKey'],
          equals: input.executionSemanticKey,
        },
        executions: {
          some: {
            userStrategyAccountId: input.accountId,
            status: 'EXECUTED' as unknown as ExecutionStatus,
          },
        },
      },
      include: {
        symbol: true,
        executions: {
          where: { userStrategyAccountId: input.accountId },
          select: {
            id: true,
            userStrategyAccountId: true,
            status: true,
            metadata: true,
            executedQuantity: true,
            positionSide: true,
            orderSide: true,
          },
        },
      },
    })
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
