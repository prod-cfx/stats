import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class FixedSignalContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() { return this.prisma.getClient() }

  findLlmStrategyByName(name: string) {
    return this.getClient().llmStrategy.findUnique({ where: { name } })
  }

  findUserByEmail(email: string) {
    return this.getClient().user.findUnique({ where: { email } })
  }

  findSymbolByCode(code: string) {
    return this.getClient().symbol.findFirst({ where: { code } })
  }

  findSymbolsByCodes(codes: string[]) {
    return this.getClient().symbol.findMany({ where: { code: { in: codes } } })
  }

  findUserStrategyAccount(userId: string, strategyId: string) {
    return this.getClient().userStrategyAccount.findFirst({
      where: { userId, strategyId },
    })
  }

  findLlmStrategyInstance(strategyId: string, name: string) {
    return this.getClient().llmStrategyInstance.findFirst({
      where: { strategyId, name },
    })
  }

  createTradingSignal(data: Parameters<ReturnType<FixedSignalContextRepository['getClient']>['tradingSignal']['create']>[0]['data']) {
    return this.getClient().tradingSignal.create({ data })
  }
}
