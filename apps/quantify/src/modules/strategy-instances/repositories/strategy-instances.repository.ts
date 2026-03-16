/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入 */
import type { Prisma, StrategyInstanceMode, StrategyInstanceStatus } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class StrategyInstancesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    strategyTemplateId: string
    name: string
    description?: string
    llmModel: string
    mode?: StrategyInstanceMode
    params?: Prisma.InputJsonValue
    metadata?: Prisma.InputJsonValue
    createdBy?: string
  }) {
    const client = this.prisma.getClient()
    return client.strategyInstance.create({
      data: {
        ...data,
        status: 'draft',
      },
    })
  }

  async findById(id: string) {
    const client = this.prisma.getClient()
    return client.strategyInstance.findUnique({
      where: { id },
    })
  }

  async findByIdWithDetails(id: string) {
    const client = this.prisma.getClient()
    return client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
          },
        },
      },
    })
  }

  async findMany(params: {
    strategyTemplateId?: string
    status?: StrategyInstanceStatus
    mode?: StrategyInstanceMode
    llmModel?: string
    skip?: number
    take?: number
  }) {
    const client = this.prisma.getClient()

    const where: Prisma.StrategyInstanceWhereInput = {}

    if (params.strategyTemplateId) {
      where.strategyTemplateId = params.strategyTemplateId
    }

    if (params.status) {
      where.status = params.status
    }

    if (params.mode) {
      where.mode = params.mode
    }

    if (params.llmModel) {
      where.llmModel = params.llmModel
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          strategyTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      }),
      client.strategyInstance.count({ where }),
    ])

    return { items, total }
  }

  /**
   * 查询运行中的策略实例（用户端）
   * 只返回 status='running' 且关联的策略模板为 'live' 状态的实例
   * 防止泄露未发布策略（draft/testing/disabled）
   */
  async findRunningInstances(params: {
    strategyTemplateId?: string
    llmModel?: string
    skip?: number
    take?: number
  }) {
    const client = this.prisma.getClient()

    const where: Prisma.StrategyInstanceWhereInput = {
      status: 'running',
      mode: 'LIVE', // 只向用户展示实盘运行的实例
      // 只公开 live 状态模板下的实例，防止泄露未发布策略
      strategyTemplate: {
        status: 'live',
      },
    }

    if (params.strategyTemplateId) {
      where.strategyTemplateId = params.strategyTemplateId
    }

    if (params.llmModel) {
      where.llmModel = params.llmModel
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { startedAt: 'desc' },
        include: {
          strategyTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      }),
      client.strategyInstance.count({ where }),
    ])

    return { items, total }
  }

  async update(
    id: string,
    data: {
      name?: string
      description?: string
      llmModel?: string
      status?: StrategyInstanceStatus
      mode?: StrategyInstanceMode
      params?: Prisma.InputJsonValue | null
      metadata?: Prisma.InputJsonValue | null
      startedAt?: Date | null
      stoppedAt?: Date | null
      updatedBy?: string
    },
  ) {
    const client = this.prisma.getClient()
    return client.strategyInstance.update({
      where: { id },
      data,
    })
  }

  async delete(id: string) {
    const client = this.prisma.getClient()
    return client.strategyInstance.delete({
      where: { id },
    })
  }

  async existsByTemplateModelName(
    strategyTemplateId: string,
    llmModel: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const client = this.prisma.getClient()
    const where: Prisma.StrategyInstanceWhereInput = {
      strategyTemplateId,
      llmModel,
      name,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const count = await client.strategyInstance.count({ where })
    return count > 0
  }
}
