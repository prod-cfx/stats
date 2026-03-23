import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SignalGeneratorRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findRunningInstances() {
    return this.txHost.tx.strategyInstance.findMany({
      where: {
        status: 'running',
        mode: 'LIVE',
        strategyTemplate: { status: 'live' },
      },
      orderBy: { id: 'asc' },
      include: { strategyTemplate: true },
    })
  }

  findStrategyInstance(id: string) {
    return this.txHost.tx.strategyInstance.findUnique({
      where: { id },
      include: { strategyTemplate: true },
    })
  }

  findEnabledIndicatorConfigs(names: string[]) {
    return this.txHost.tx.indicatorConfig.findMany({
      where: { name: { in: names }, isEnabled: true },
      include: { symbol: true },
    })
  }

  groupLatestIndicatorValues(indicatorConfigIds: string[]) {
    return this.txHost.tx.indicatorValue.groupBy({
      by: ['indicatorConfigId'],
      where: { indicatorConfigId: { in: indicatorConfigIds } },
      _max: { time: true },
    })
  }

  findLatestIndicatorValues(conditions: Array<{ indicatorConfigId: string; time: Date }>) {
    return this.txHost.tx.indicatorValue.findMany({
      where: {
        OR: conditions,
      },
      orderBy: { time: 'desc' },
    })
  }

  findSymbolsByCode(codes: string[]) {
    return this.txHost.tx.symbol.findMany({
      where: { code: { in: codes } },
    })
  }

  findSymbolByCode(code: string) {
    return this.txHost.tx.symbol.findUnique({ where: { code } })
  }

  async createSignalWithCooldownLock(params: {
    instanceId: string
    strategyId: string
    symbolId: string
    cooldownSince: Date
    skipCooldown: boolean
    data: Prisma.TradingSignalCreateInput
  }): Promise<{ created: boolean; signalId: string | null }> {
    return this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx
      await tx.$queryRaw`
        SELECT "id"
        FROM "strategy_instances"
        WHERE "id" = ${params.instanceId}
        FOR UPDATE
      `

      if (!params.skipCooldown) {
        const existingCount = await tx.tradingSignal.count({
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

      const signal = await tx.tradingSignal.create({ data: params.data })
      return { created: true as const, signalId: signal.id }
    })
  }

  countRecentSignals(strategyId: string, symbolId: string, since: Date) {
    return this.txHost.tx.tradingSignal.count({
      where: {
        strategyId,
        symbolId,
        createdAt: { gte: since },
      },
    })
  }
}
