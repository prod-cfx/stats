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
   * 缁熻鎸囧畾瀹炰緥鍦ㄧ粰瀹氭椂闂寸偣涔嬪悗鐨?鏈夋晥杩愯"娆℃暟銆?
   * 鏈夋晥杩愯鎸?status !== 'skipped' 鐨?run锛岀敤浜?maxRunsPerHour 鑺傛祦閫昏緫銆?
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
