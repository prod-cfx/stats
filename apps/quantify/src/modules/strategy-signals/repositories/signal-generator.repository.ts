import type { Prisma } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { normalizeRequestedCode } from '@/modules/market-data/utils/market-symbol-code.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SignalGeneratorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() { return this.prisma.getClient() }

  findRunningInstances() {
    return this.getClient().strategyInstance.findMany({
      where: {
        status: 'running',
        mode: { in: ['LIVE', 'TESTNET'] },
        strategyTemplate: { status: 'live' },
      },
      orderBy: { id: 'asc' },
      include: { strategyTemplate: true },
    })
  }

  findStrategyInstance(id: string) {
    return this.getClient().strategyInstance.findUnique({
      where: { id },
      include: { strategyTemplate: true },
    })
  }

  findEnabledIndicatorConfigs(names: string[]) {
    return this.getClient().indicatorConfig.findMany({
      where: { name: { in: names }, isEnabled: true },
      include: { symbol: true },
    })
  }

  groupLatestIndicatorValues(indicatorConfigIds: string[]) {
    return this.getClient().indicatorValue.groupBy({
      by: ['indicatorConfigId'],
      where: { indicatorConfigId: { in: indicatorConfigIds } },
      _max: { time: true },
    })
  }

  findLatestIndicatorValues(conditions: Array<{ indicatorConfigId: string; time: Date }>) {
    return this.getClient().indicatorValue.findMany({
      where: {
        OR: conditions,
      },
      orderBy: { time: 'desc' },
    })
  }

  findSymbolsByCode(codes: string[]) {
    const normalizedCodes = [...new Set(codes.map(code => normalizeRequestedCode(code)))]
    return this.getClient().symbol.findMany({
      where: { code: { in: normalizedCodes } },
    })
  }

  findSymbolByCode(code: string) {
    return this.getClient().symbol.findUnique({
      where: {
        code: normalizeRequestedCode(code),
      },
    })
  }

  async createSignalWithCooldownLock(params: {
    instanceId: string
    strategyId: string
    symbolId: string
    cooldownSince: Date
    skipCooldown: boolean
    data: Prisma.TradingSignalCreateInput
  }): Promise<{ created: boolean; signalId: string | null }> {
    return this.prisma.$transaction(async (prisma) => {
      await prisma.$queryRaw`
        SELECT "id"
        FROM "strategy_instances"
        WHERE "id" = ${params.instanceId}
        FOR UPDATE
      `

      if (!params.skipCooldown) {
        const existingCount = await prisma.tradingSignal.count({
          where: {
            strategyId: params.strategyId,
            symbolId: params.symbolId,
            createdAt: { gte: params.cooldownSince },
            OR: [{ strategyInstanceId: params.instanceId }, { strategyInstanceId: null }],
          },
        })

        if (existingCount > 0) {
          return { created: false as const, signalId: null as string | null }
        }
      }

      const signal = await prisma.tradingSignal.create({ data: params.data })
      return { created: true as const, signalId: signal.id }
    })
  }

  countRecentSignals(strategyId: string, symbolId: string, since: Date) {
    return this.getClient().tradingSignal.count({
      where: {
        strategyId,
        symbolId,
        createdAt: { gte: since },
      },
    })
  }

  /** @internal 仅供 Service 层事务编排使用 */
  runInTransaction<T>(fn: (client: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn)
  }
}
