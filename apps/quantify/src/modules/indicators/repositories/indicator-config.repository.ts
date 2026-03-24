import type { QuantifyMarketTimeframe as MarketTimeframe } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, IndicatorConfig, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface IndicatorConfigListParams {
  symbolCode?: string
  timeframe?: MarketTimeframe
  type?: string
  isEnabled?: boolean
  skip?: number
  take?: number
}

@Injectable()
export class IndicatorConfigRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findById(id: string): Promise<IndicatorConfig | null> {
    return this.txHost.tx.indicatorConfig.findUnique({
      where: { id },
    })
  }

  async list(params: IndicatorConfigListParams): Promise<[IndicatorConfig[], number]> {
    const where: Prisma.IndicatorConfigWhereInput = {}

    if (params.isEnabled !== undefined) {
      where.isEnabled = params.isEnabled
    }

    if (params.timeframe) {
      where.timeframe = params.timeframe
    }

    if (params.type) {
      where.type = params.type as any
    }

    if (params.symbolCode) {
      where.symbol = {
        code: params.symbolCode.toUpperCase(),
      }
    }

    const skip = params.skip ?? 0
    const take = params.take ?? 50

    const [items, total] = await Promise.all([
      this.txHost.tx.indicatorConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.txHost.tx.indicatorConfig.count({ where }),
    ])

    return [items, total]
  }

  async listAllActive(): Promise<IndicatorConfig[]> {
    return this.txHost.tx.indicatorConfig.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        symbolId: 'asc',
      },
    })
  }

  async listActiveBySymbolAndTimeframe(symbolId: string, timeframe: MarketTimeframe): Promise<IndicatorConfig[]> {
    return this.txHost.tx.indicatorConfig.findMany({
      where: {
        symbolId,
        timeframe,
        isEnabled: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
  }

  async create(data: Prisma.IndicatorConfigCreateInput): Promise<IndicatorConfig> {
    return this.txHost.tx.indicatorConfig.create({
      data,
    })
  }

  async update(id: string, data: Prisma.IndicatorConfigUpdateInput): Promise<IndicatorConfig> {
    return this.txHost.tx.indicatorConfig.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<IndicatorConfig> {
    return this.txHost.tx.indicatorConfig.delete({
      where: { id },
    })
  }

  async findSymbolByCode(code: string): Promise<{ id: string; code: string } | null> {
    return this.txHost.tx.symbol.findUnique({
      where: { code },
      select: { id: true, code: true },
    })
  }
}
