import type {
  LlmStrategyInstance,
  LlmStrategyInstanceStatus,
  Prisma,
} from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

interface ListParams {
  status?: LlmStrategyInstanceStatus
  strategyId?: string
  skip?: number
  take?: number
  orderBy?: Prisma.LlmStrategyInstanceOrderByWithRelationInput
}

@Injectable()
export class LlmStrategyInstancesRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async findById(id: string): Promise<LlmStrategyInstance | null> {
    return this.client.llmStrategyInstance.findUnique({
      where: { id },
    })
  }

  async findByIdWithStrategy(id: string) {
    return this.client.llmStrategyInstance.findUnique({
      where: { id },
      include: {
        strategy: true,
      },
    })
  }

  async list(params: ListParams): Promise<LlmStrategyInstance[]> {
    const where: Prisma.LlmStrategyInstanceWhereInput = {}

    if (params.status) {
      where.status = params.status
    }

    if (params.strategyId) {
      where.strategyId = params.strategyId
    }

    const skip = params.skip !== undefined ? Math.max(0, params.skip) : undefined
    const take = params.take !== undefined ? Math.max(1, Math.min(params.take, 100)) : undefined

    return this.client.llmStrategyInstance.findMany({
      where,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
      skip,
      take,
    })
  }

  async count(params: ListParams): Promise<number> {
    const where: Prisma.LlmStrategyInstanceWhereInput = {}

    if (params.status) {
      where.status = params.status
    }

    if (params.strategyId) {
      where.strategyId = params.strategyId
    }

    return this.client.llmStrategyInstance.count({ where })
  }

  async listByStatus(
    status: LlmStrategyInstanceStatus,
  ): Promise<LlmStrategyInstance[]> {
    return this.list({ status })
  }

  async create(data: Prisma.LlmStrategyInstanceCreateInput): Promise<LlmStrategyInstance> {
    return this.client.llmStrategyInstance.create({ data })
  }

  async update(
    id: string,
    data: Prisma.LlmStrategyInstanceUpdateInput,
  ): Promise<LlmStrategyInstance | null> {
    const instance = await this.client.llmStrategyInstance.findUnique({
      where: { id },
    })

    if (!instance) {
      return null
    }

    return this.client.llmStrategyInstance.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.llmStrategyInstance.delete({
      where: { id },
    })
  }
}
