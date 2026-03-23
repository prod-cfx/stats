import type { InstrumentType, Prisma, SignalStatus } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SignalExecutorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() { return this.prisma.getClient() }

  findPendingOrFailedSignals(limit: number) {
    const now = new Date()
    return this.getClient().tradingSignal.findMany({
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
    return this.getClient().userStrategyAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
    })
  }

  findActiveLlmSubscription(userId: string, llmStrategyInstanceId: string) {
    return this.getClient().userLlmStrategySubscription.findFirst({
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
    return this.getClient().symbol.findFirst({
      where: {
        exchange: params.exchange,
        baseAsset: params.baseAsset,
        quoteAsset: params.quoteAsset,
        instrumentType: params.instrumentType,
        status: 'ACTIVE',
      },
    })
  }

  /** @internal 仅供 Service 层事务编排使用 */
  runInTransaction<T>(fn: (client: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn)
  }
}
