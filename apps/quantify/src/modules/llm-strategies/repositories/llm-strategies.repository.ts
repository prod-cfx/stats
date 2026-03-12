import type { LlmStrategy, LlmStrategyStatus, Prisma } from '@prisma/client'
import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

interface ListParams {
  status?: LlmStrategyStatus
  keyword?: string
  skip?: number
  take?: number
  orderBy?: Prisma.LlmStrategyOrderByWithRelationInput
}

@Injectable()
export class LlmStrategiesRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async findById(id: string): Promise<LlmStrategy | null> {
    return this.client.llmStrategy.findUnique({
      where: { id },
    })
  }

  async findByName(name: string): Promise<LlmStrategy | null> {
    return this.client.llmStrategy.findFirst({
      where: { name },
    })
  }

  async list(params: ListParams): Promise<LlmStrategy[]> {
    const where: Prisma.LlmStrategyWhereInput = {}

    if (params.status) {
      where.status = params.status
    }

    if (params.keyword) {
      where.OR = [
        { name: { contains: params.keyword, mode: 'insensitive' } },
        { description: { contains: params.keyword, mode: 'insensitive' } },
      ]
    }

    const skip = params.skip !== undefined ? Math.max(0, params.skip) : undefined
    const take = params.take !== undefined ? Math.max(1, Math.min(params.take, 100)) : undefined

    return this.client.llmStrategy.findMany({
      where,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
      skip,
      take,
    })
  }

  async create(data: Prisma.LlmStrategyCreateInput): Promise<LlmStrategy> {
    return this.client.llmStrategy.create({ data })
  }

  async update(
    id: string,
    data: Prisma.LlmStrategyUpdateInput,
  ): Promise<LlmStrategy | null> {
    const strategy = await this.client.llmStrategy.findUnique({
      where: { id },
    })

    if (!strategy) {
      return null
    }

    return this.client.llmStrategy.update({
      where: { id },
      data,
    })
  }

  async count(params: { status?: LlmStrategyStatus; keyword?: string }): Promise<number> {
    const where: Prisma.LlmStrategyWhereInput = {}

    if (params.status) {
      where.status = params.status
    }

    if (params.keyword) {
      where.OR = [
        { name: { contains: params.keyword, mode: 'insensitive' } },
        { description: { contains: params.keyword, mode: 'insensitive' } },
      ]
    }

    return this.client.llmStrategy.count({ where })
  }

  async delete(id: string): Promise<void> {
    await this.client.llmStrategy.delete({
      where: { id },
    })
  }
}
