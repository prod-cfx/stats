import type { AiSignalPayload } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { RuntimeMarketType } from '@/modules/market-data/utils/market-symbol-code.util'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { normalizeRequestedCode, normalizeRequestedCodeForMarket } from '@/modules/market-data/utils/market-symbol-code.util'
import { RUNTIME_BINDING_STATUS } from '../types/runtime-binding-status.type'

const COOLDOWN_SIGNAL_STATUSES = ['PENDING', 'EXECUTED', 'PARTIAL'] as const

export interface RuntimeCooldownScope {
  strategyInstanceId: string
  publishedSnapshotId: string
  executionSemanticKey: string
}

export interface CountRecentSignalsInput {
  strategyId: string
  symbolId: string
  since: Date
  signalType?: AiSignalPayload['signalType']
  direction?: AiSignalPayload['direction']
  runtimeScope?: RuntimeCooldownScope
}

export interface FindRecentSignalForCooldownInput {
  strategyId: string
  symbolId: string
  instanceId: string
  cooldownSince: Date
  signalType?: AiSignalPayload['signalType']
  direction?: AiSignalPayload['direction']
  runtimeScope?: RuntimeCooldownScope
}

@Injectable()
export class SignalGeneratorRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findRunningInstances() {
    return this.txHost.tx.strategyInstance.findMany({
      where: {
        status: 'running',
        mode: { in: ['LIVE', 'TESTNET'] },
        runtimeBindingStatus: RUNTIME_BINDING_STATUS.READY,
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
    const normalizedCodes = [...new Set(codes.map(code => normalizeRequestedCode(code)))]
    return this.txHost.tx.symbol.findMany({
      where: { code: { in: normalizedCodes } },
    })
  }

  findSymbolsByCodeForMarket(codes: string[], marketType: RuntimeMarketType) {
    const normalizedCodes = [...new Set(codes.map(code => normalizeRequestedCodeForMarket(code, marketType)))]
    return this.txHost.tx.symbol.findMany({
      where: { code: { in: normalizedCodes } },
    })
  }

  findSymbolByCode(code: string) {
    return this.txHost.tx.symbol.findUnique({
      where: {
        code: normalizeRequestedCode(code),
      },
    })
  }

  findSymbolByCodeForMarket(code: string, marketType: RuntimeMarketType) {
    return this.txHost.tx.symbol.findUnique({
      where: {
        code: normalizeRequestedCodeForMarket(code, marketType),
      },
    })
  }

  lockStrategyInstance(instanceId: string) {
    return this.txHost.tx.$queryRaw`
      SELECT "id"
      FROM "strategy_instances"
      WHERE "id" = ${instanceId}
      FOR UPDATE
    `
  }

  async createSignalWithCooldownLock(params: {
    instanceId: string
    strategyId: string
    symbolId: string
    cooldownSince: Date
    skipCooldown: boolean
    signalType?: AiSignalPayload['signalType']
    direction?: AiSignalPayload['direction']
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
            status: { in: [...COOLDOWN_SIGNAL_STATUSES] },
            ...(params.signalType ? { signalType: params.signalType } : {}),
            ...(params.direction ? { direction: params.direction } : {}),
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

  findRecentSignalForCooldown(input: FindRecentSignalForCooldownInput) {
    return this.txHost.tx.tradingSignal.findFirst({
      where: this.buildCooldownWhere({
        strategyId: input.strategyId,
        symbolId: input.symbolId,
        since: input.cooldownSince,
        instanceId: input.instanceId,
        signalType: input.signalType,
        direction: input.direction,
        runtimeScope: input.runtimeScope,
      }),
      orderBy: { createdAt: 'desc' },
    })
  }

  countRecentSignals(input: CountRecentSignalsInput) {
    return this.txHost.tx.tradingSignal.count({
      where: this.buildCooldownWhere({
        strategyId: input.strategyId,
        symbolId: input.symbolId,
        since: input.since,
        signalType: input.signalType,
        direction: input.direction,
        runtimeScope: input.runtimeScope,
      }),
    })
  }

  findOpenPositionsForAdmission(input: {
    strategyId: string
    strategyInstanceId: string
    exchangeId: ExchangeId
    marketType: MarketType
    symbol: string
  }) {
    return this.txHost.tx.position.findMany({
      where: {
        symbol: input.symbol,
        exchangeId: input.exchangeId,
        marketType: input.marketType,
        status: 'OPEN',
        account: {
          strategyId: input.strategyId,
          user: {
            strategySubscriptions: {
              some: {
                strategyInstanceId: input.strategyInstanceId,
                status: 'active',
              },
            },
          },
        },
      },
      select: {
        positionSide: true,
        quantity: true,
      },
    })
  }

  async hasPendingReconcileRequiredEntryExecution(input: {
    strategyId: string
    strategyInstanceId: string
  }): Promise<boolean> {
    const count = await this.txHost.tx.userSignalExecution.count({
      where: {
        status: 'FAILED',
        orderSide: { in: ['BUY', 'SELL'] },
        signal: {
          signalType: 'ENTRY',
        },
        metadata: {
          path: ['reconcileRequired'],
          equals: true,
        },
        account: {
          strategyId: input.strategyId,
          user: {
            strategySubscriptions: {
              some: {
                strategyInstanceId: input.strategyInstanceId,
                status: 'active',
              },
            },
          },
        },
      },
    })
    return count > 0
  }

  private buildCooldownWhere(input: {
    strategyId: string
    symbolId: string
    since: Date
    instanceId?: string
    signalType?: AiSignalPayload['signalType']
    direction?: AiSignalPayload['direction']
    runtimeScope?: RuntimeCooldownScope
  }): Prisma.TradingSignalWhereInput {
    if (input.runtimeScope) {
      return {
        strategyId: input.strategyId,
        symbolId: input.symbolId,
        createdAt: { gte: input.since },
        status: { in: [...COOLDOWN_SIGNAL_STATUSES] },
        ...(input.signalType ? { signalType: input.signalType } : {}),
        ...(input.direction ? { direction: input.direction } : {}),
        strategyInstanceId: input.runtimeScope.strategyInstanceId,
        AND: [{
          metadata: {
            path: ['runtimeProvenance', 'publishedSnapshotId'],
            equals: input.runtimeScope.publishedSnapshotId,
          },
        }, {
          metadata: {
            path: ['runtimeProvenance', 'executionSemanticKey'],
            equals: input.runtimeScope.executionSemanticKey,
          },
        }],
      }
    }

    return {
      strategyId: input.strategyId,
      symbolId: input.symbolId,
      createdAt: { gte: input.since },
      status: { in: [...COOLDOWN_SIGNAL_STATUSES] },
      ...(input.signalType ? { signalType: input.signalType } : {}),
      ...(input.direction ? { direction: input.direction } : {}),
      ...(input.instanceId
        ? {
            OR: [{ strategyInstanceId: input.instanceId }, { strategyInstanceId: null }],
          }
        : {}),
    }
  }
}
