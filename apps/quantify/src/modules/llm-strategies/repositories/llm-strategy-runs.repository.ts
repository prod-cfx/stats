import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategyRun, Prisma, TradingSignal } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class LlmStrategyRunsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(data: Prisma.LlmStrategyRunCreateInput): Promise<LlmStrategyRun> {
    return this.txHost.tx.llmStrategyRun.create({ data })
  }

  async findById(id: string): Promise<LlmStrategyRun | null> {
    return this.txHost.tx.llmStrategyRun.findUnique({
      where: { id },
      include: {
        generatedSignal: {
          include: {
            symbol: true,
          },
        },
      },
    })
  }

  async listRecentByInstance(
    instanceId: string,
    limit = 20,
  ): Promise<LlmStrategyRun[]> {
    const validatedLimit = Math.max(1, Math.min(limit, 100))

    return this.txHost.tx.llmStrategyRun.findMany({
      where: {
        strategyInstanceId: instanceId,
      },
      include: {
        generatedSignal: {
          include: {
            symbol: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: validatedLimit,
    })
  }

  /**
   * 统计指定实例在给定时间点之后的"有效运行"次数。
   * 有效运行指 status !== 'skipped' 的 run，用于 maxRunsPerHour 节流逻辑。
   */
  async countEffectiveRunsSince(
    instanceId: string,
    since: Date,
  ): Promise<number> {
    return this.txHost.tx.llmStrategyRun.count({
      where: {
        strategyInstanceId: instanceId,
        startedAt: {
          gte: since,
        },
        NOT: {
          status: 'skipped',
        },
      },
    })
  }

  /**
   * 原子操作：在事务中查找 symbol、创建 TradingSignal 并将其关联到指定 Run 记录。
   * 若 symbol 不存在返回 null（由调用方抛出业务异常）。
   */
  async createTradingSignalAndLinkRun(
    symbolCode: string,
    signalData: (symbolId: string) => Prisma.TradingSignalCreateInput,
    runId: string,
  ): Promise<{ tradingSignal: TradingSignal; symbolFound: true } | { symbolFound: false }> {
    return this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx
      const symbolRecord = await tx.symbol.findUnique({ where: { code: symbolCode } })
      if (!symbolRecord) {
        return { symbolFound: false } as const
      }
      const tradingSignal = await tx.tradingSignal.create({ data: signalData(symbolRecord.id) })
      await tx.llmStrategyRun.update({
        where: { id: runId },
        data: { generatedSignal: { connect: { id: tradingSignal.id } } },
      })
      return { tradingSignal, symbolFound: true } as const
    })
  }

  async update(
    id: string,
    data: Prisma.LlmStrategyRunUpdateInput,
  ): Promise<LlmStrategyRun | null> {
    const run = await this.txHost.tx.llmStrategyRun.findUnique({
      where: { id },
      include: {
        generatedSignal: {
          include: {
            symbol: true,
          },
        },
      },
    })

    if (!run) {
      return null
    }

    return this.txHost.tx.llmStrategyRun.update({
      where: { id },
      data,
    })
  }
}
