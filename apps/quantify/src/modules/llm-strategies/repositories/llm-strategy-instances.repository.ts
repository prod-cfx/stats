import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategyInstance,
  Prisma, } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

interface ListParams {
  status?: LlmStrategyInstanceStatus
  strategyId?: string
  skip?: number
  take?: number
  orderBy?: Prisma.LlmStrategyInstanceOrderByWithRelationInput
}

@Injectable()
export class LlmStrategyInstancesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findById(id: string): Promise<LlmStrategyInstance | null> {
    return this.txHost.tx.llmStrategyInstance.findUnique({
      where: { id },
    })
  }

  async findByIdWithStrategy(id: string) {
    return this.txHost.tx.llmStrategyInstance.findUnique({
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

    return this.txHost.tx.llmStrategyInstance.findMany({
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

    return this.txHost.tx.llmStrategyInstance.count({ where })
  }

  async listByStatus(
    status: LlmStrategyInstanceStatus,
  ): Promise<LlmStrategyInstance[]> {
    return this.list({ status })
  }

  async create(data: Prisma.LlmStrategyInstanceCreateInput): Promise<LlmStrategyInstance> {
    return this.txHost.tx.llmStrategyInstance.create({ data })
  }

  async update(
    id: string,
    data: Prisma.LlmStrategyInstanceUpdateInput,
  ): Promise<LlmStrategyInstance | null> {
    const instance = await this.txHost.tx.llmStrategyInstance.findUnique({
      where: { id },
    })

    if (!instance) {
      return null
    }

    return this.txHost.tx.llmStrategyInstance.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.llmStrategyInstance.delete({
      where: { id },
    })
  }

  async findRunningLiveInstances(params: {
    llmModel?: string
    strategyId?: string
    skip: number
    take: number
  }) {
    const where: Prisma.LlmStrategyInstanceWhereInput = {
      status: 'running' as LlmStrategyInstanceStatus,
      mode: 'LIVE' as LlmStrategyInstanceMode,
      strategy: { status: 'live' as const },
      ...(params.llmModel ? { llmModel: params.llmModel } : {}),
      ...(params.strategyId ? { strategyId: params.strategyId } : {}),
    }

    const [items, total] = await Promise.all([
      this.txHost.tx.llmStrategyInstance.findMany({
        where,
        include: { strategy: { select: { name: true, description: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.txHost.tx.llmStrategyInstance.count({ where }),
    ])

    return { items, total }
  }

  async findByIdWithStrategyDetail(id: string) {
    return this.txHost.tx.llmStrategyInstance.findUnique({
      where: { id },
      include: {
        strategy: { select: { name: true, description: true, status: true } },
      },
    })
  }

  /**
   * 写入策略部署时的语义版本号，供 atom 翻牌 version-gate 使用。
   * 走 txHost.tx 自动参与外层事务（与 PublishedStrategySnapshot 写入同事务）。
   */
  async markDeployedWithSemanticVersion(
    id: string,
    deployedAtSemanticVersion: string,
  ): Promise<LlmStrategyInstance> {
    return this.txHost.tx.llmStrategyInstance.update({
      where: { id },
      data: { deployedAtSemanticVersion },
    })
  }

  async findRunningWithSchedule() {
    return this.txHost.tx.llmStrategyInstance.findMany({
      where: {
        status: 'running',
        scheduleCron: { not: null },
      },
      include: {
        strategy: {
          select: { id: true, name: true, status: true },
        },
      },
    })
  }
}
