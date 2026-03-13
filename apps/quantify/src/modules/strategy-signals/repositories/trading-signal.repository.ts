import type { Prisma, SignalStatus } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

export interface FindSignalOptions {
  includeStrategy?: boolean
  includeSymbol?: boolean
}

@Injectable()
export class TradingSignalRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(data: Prisma.TradingSignalCreateInput) {
    return this.prisma.tradingSignal.create({ data })
  }

  async findById(id: string, options?: FindSignalOptions) {
    return this.prisma.tradingSignal.findUnique({
      where: { id },
      include: {
        strategy: Boolean(options?.includeStrategy),
        symbol: Boolean(options?.includeSymbol),
      },
    })
  }

  async existsRecent(strategyId: string, symbolId: string, since: Date) {
    const count = await this.prisma.tradingSignal.count({
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
    await this.prisma.tradingSignal.update({
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
      this.prisma.tradingSignal.findMany({
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
      this.prisma.tradingSignal.count({ where }),
    ])

    return { items, total, page, limit }
  }
}
