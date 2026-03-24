import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategy, LlmStrategyStatus, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

interface ListParams {
  status?: LlmStrategyStatus
  keyword?: string
  skip?: number
  take?: number
  orderBy?: Prisma.LlmStrategyOrderByWithRelationInput
}

@Injectable()
export class LlmStrategiesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findById(id: string): Promise<LlmStrategy | null> {
    return this.txHost.tx.llmStrategy.findUnique({
      where: { id },
    })
  }

  async findByName(name: string): Promise<LlmStrategy | null> {
    return this.txHost.tx.llmStrategy.findFirst({
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

    return this.txHost.tx.llmStrategy.findMany({
      where,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
      skip,
      take,
    })
  }

  async create(data: Prisma.LlmStrategyCreateInput): Promise<LlmStrategy> {
    return this.txHost.tx.llmStrategy.create({ data })
  }

  async update(
    id: string,
    data: Prisma.LlmStrategyUpdateInput,
  ): Promise<LlmStrategy | null> {
    const strategy = await this.txHost.tx.llmStrategy.findUnique({
      where: { id },
    })

    if (!strategy) {
      return null
    }

    return this.txHost.tx.llmStrategy.update({
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

    return this.txHost.tx.llmStrategy.count({ where })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.llmStrategy.delete({
      where: { id },
    })
  }
}
