import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { SignalStatus } from '@ai/shared'
import type { PrismaClient, InstrumentType, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SignalExecutorRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findPendingOrFailedSignals(limit: number) {
    const now = new Date()
    return this.txHost.tx.tradingSignal.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] satisfies SignalStatus[] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
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
}
