import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { SignalStatus } from '@ai/shared'
import type { PrismaClient, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

export interface FindSignalOptions {
  includeStrategy?: boolean
  includeSymbol?: boolean
}

@Injectable()
export class TradingSignalRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(data: Prisma.TradingSignalCreateInput) {
    return this.txHost.tx.tradingSignal.create({ data })
  }

  async findById(id: string, options?: FindSignalOptions) {
    return this.txHost.tx.tradingSignal.findUnique({
      where: { id },
      include: {
        strategy: Boolean(options?.includeStrategy),
        symbol: Boolean(options?.includeSymbol),
      },
    })
  }

  async existsRecent(strategyId: string, symbolId: string, since: Date) {
    const count = await this.txHost.tx.tradingSignal.count({
      where: {
        strategyId,
        symbolId,
        createdAt: {
          gte: since,
        },
      },
    })
    return count > 0
  }

  async updateStatus(id: string, status: SignalStatus, metadata?: Prisma.JsonValue) {
    await this.txHost.tx.tradingSignal.update({
      where: { id },
      data: {
        status,
        metadata: metadata || undefined,
      },
    })
  }

  async findMany(params: {
    strategyInstanceId?: string
    strategyId?: string
    llmStrategyId?: string
    llmStrategyInstanceId?: string
    symbolId?: string
    status?: SignalStatus
    page: number
    limit: number
  }) {
    const { strategyInstanceId, strategyId, llmStrategyId, llmStrategyInstanceId, symbolId, status, page, limit } = params
    const where: Prisma.TradingSignalWhereInput = {}

    if (strategyInstanceId) where.strategyInstanceId = strategyInstanceId
    if (strategyId) where.strategyId = strategyId
    if (llmStrategyId) where.llmStrategyId = llmStrategyId
    if (llmStrategyInstanceId) where.llmStrategyInstanceId = llmStrategyInstanceId
    if (symbolId) where.symbolId = symbolId
    if (status) where.status = status

    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.txHost.tx.tradingSignal.findMany({
        where,
        include: {
          symbol: {
            select: {
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.txHost.tx.tradingSignal.count({ where }),
    ])

    return new BasePaginationResponseDto(total, page, limit, items)
  }
}
