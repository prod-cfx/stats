import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class StrategySignalStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByStrategyInstanceId(strategyInstanceId: string) {
    return this.prisma.strategySignalState.findUnique({
      where: { strategyInstanceId }
    })
  }

  async incrementFailure(strategyInstanceId: string, options?: { lockedUntil?: Date; reset?: boolean }) {
    const { lockedUntil, reset } = options ?? {}

    // 获取实例对应的模板ID
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { strategyTemplateId: true },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${strategyInstanceId} not found`)
    }

    await this.prisma.strategySignalState.upsert({
      where: { strategyInstanceId },
      update: reset
        ? {
            consecutiveFailures: 0,
            lockedUntil,
          }
        : {
            consecutiveFailures: { increment: 1 },
            ...(lockedUntil ? { lockedUntil } : {}),
          },
      create: {
        strategyId: instance.strategyTemplateId,
        strategyInstance: { connect: { id: strategyInstanceId } },
        consecutiveFailures: reset ? 0 : 1,
        lockedUntil,
      },
    })
  }

  async reset(strategyInstanceId: string) {
    // 获取实例对应的模板ID
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { strategyTemplateId: true },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${strategyInstanceId} not found`)
    }

    await this.prisma.strategySignalState.upsert({
      where: { strategyInstanceId },
      update: {
        consecutiveFailures: 0,
        lockedUntil: null,
      },
      create: {
        strategyId: instance.strategyTemplateId,
        strategyInstance: { connect: { id: strategyInstanceId } },
        consecutiveFailures: 0,
        lockedUntil: null,
      },
    })
  }
}
