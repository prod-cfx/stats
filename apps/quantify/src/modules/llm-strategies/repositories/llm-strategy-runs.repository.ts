import type { LlmStrategyRun, Prisma } from '@/prisma/prisma.types'
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
