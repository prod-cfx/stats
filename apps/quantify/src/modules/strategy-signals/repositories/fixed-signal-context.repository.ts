import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class FixedSignalContextRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findLlmStrategyByName(name: string) {
    return this.txHost.tx.llmStrategy.findUnique({ where: { name } })
  }

  findUserByEmail(email: string) {
    return this.txHost.tx.user.findUnique({ where: { email } })
  }

  findSymbolByCode(code: string) {
    return this.txHost.tx.symbol.findFirst({ where: { code } })
  }

  findSymbolsByCodes(codes: string[]) {
    return this.txHost.tx.symbol.findMany({ where: { code: { in: codes } } })
  }

  findUserStrategyAccount(userId: string, strategyId: string) {
    return this.txHost.tx.userStrategyAccount.findFirst({
      where: { userId, strategyId },
    })
  }

  findLlmStrategyInstance(strategyId: string, name: string) {
    return this.txHost.tx.llmStrategyInstance.findFirst({
      where: { strategyId, name },
    })
  }

  createTradingSignal(data: Prisma.TradingSignalUncheckedCreateInput) {
    return this.txHost.tx.tradingSignal.create({ data })
  }
}
