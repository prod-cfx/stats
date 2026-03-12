import type { IndicatorConfig, MarketTimeframe, Prisma } from '@prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

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
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async findById(id: string): Promise<IndicatorConfig | null> {
    return this.client.indicatorConfig.findUnique({
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
      this.client.indicatorConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.client.indicatorConfig.count({ where }),
    ])

    return [items, total]
  }

  async listAllActive(): Promise<IndicatorConfig[]> {
    return this.client.indicatorConfig.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        symbolId: 'asc',
      },
    })
  }

  async listActiveBySymbolAndTimeframe(symbolId: string, timeframe: MarketTimeframe): Promise<IndicatorConfig[]> {
    return this.client.indicatorConfig.findMany({
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
    return this.client.indicatorConfig.create({
      data,
    })
  }

  async update(id: string, data: Prisma.IndicatorConfigUpdateInput): Promise<IndicatorConfig> {
    return this.client.indicatorConfig.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<IndicatorConfig> {
    return this.client.indicatorConfig.delete({
      where: { id },
    })
  }
}
