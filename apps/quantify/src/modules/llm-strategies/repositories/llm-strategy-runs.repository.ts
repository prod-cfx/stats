import type { LlmStrategyRun, Prisma, TradingSignal } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class LlmStrategyRunsRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async create(data: Prisma.LlmStrategyRunCreateInput): Promise<LlmStrategyRun> {
    return this.client.llmStrategyRun.create({ data })
  }

  async findById(id: string): Promise<LlmStrategyRun | null> {
    return this.client.llmStrategyRun.findUnique({
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

    return this.client.llmStrategyRun.findMany({
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
   * 统计指定实例在给定时间点之后的“有效运行”次数。
   * 有效运行指 status !== 'skipped' 的 run，用于 maxRunsPerHour 节流逻辑。
   */
  async countEffectiveRunsSince(
    instanceId: string,
    since: Date,
  ): Promise<number> {
    return this.client.llmStrategyRun.count({
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
    return this.prisma.getClient().$transaction(async (tx) => {
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
    const run = await this.client.llmStrategyRun.findUnique({
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

    return this.client.llmStrategyRun.update({
      where: { id },
      data,
    })
  }
}
