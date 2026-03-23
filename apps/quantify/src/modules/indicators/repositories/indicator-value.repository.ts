import type { IndicatorValue, MarketBar, MarketTimeframe, Prisma, PrismaClient, IndicatorType as PrismaIndicatorType } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

export interface IndicatorSeriesQuery {
  symbolId: string
  timeframe: MarketTimeframe
  indicatorConfigIds?: string[]
  start?: Date
  end?: Date
  limit?: number
}

export interface IndicatorSnapshotQuery {
  symbolId: string
  timeframe: MarketTimeframe
  indicatorConfigIds?: string[]
  at?: Date
}

export interface IndicatorValueUpsertInput {
  indicatorConfigId: string
  symbolId: string
  timeframe: MarketTimeframe
  type: PrismaIndicatorType
  time: Date
  valueNumeric: Prisma.Decimal | number
  valueJson: Prisma.JsonValue | null
  createdAt: Date
}

@Injectable()
export class IndicatorValueRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async upsertMany(values: IndicatorValueUpsertInput[]): Promise<void> {
    if (!values.length) return

    const client = this.prisma.getClient() as PrismaClient

    await client.$transaction(
      values.map(value =>
        client.indicatorValue.upsert({
          where: {
            indicatorConfigId_time: {
              indicatorConfigId: value.indicatorConfigId,
              time: value.time,
            },
          },
          create: {
            config: { connect: { id: value.indicatorConfigId } },
            symbol: { connect: { id: value.symbolId } },
            timeframe: value.timeframe,
            type: value.type,
            time: value.time,
            valueNumeric: value.valueNumeric,
            valueJson: value.valueJson,
            createdAt: value.createdAt,
          },
          update: {
            valueNumeric: value.valueNumeric,
            valueJson: value.valueJson,
          },
        }),
      ),
    )
  }

  async getSeries(query: IndicatorSeriesQuery): Promise<IndicatorValue[]> {
    const where: Prisma.IndicatorValueWhereInput = {
      symbolId: query.symbolId,
      timeframe: query.timeframe,
    }

    if (query.indicatorConfigIds?.length) {
      where.indicatorConfigId = {
        in: query.indicatorConfigIds,
      }
    }

    if (query.start || query.end) {
      where.time = {}
      if (query.start) where.time.gte = query.start
      if (query.end) where.time.lte = query.end
    }

    const take = query.limit && query.limit > 0 ? query.limit : 500

    return this.client.indicatorValue.findMany({
      where,
      orderBy: { time: 'asc' },
      take,
    })
  }

  async getSnapshot(query: IndicatorSnapshotQuery): Promise<IndicatorValue[]> {
    const where: Prisma.IndicatorValueWhereInput = {
      symbolId: query.symbolId,
      timeframe: query.timeframe,
    }

    if (query.indicatorConfigIds?.length) {
      where.indicatorConfigId = {
        in: query.indicatorConfigIds,
      }
    }

    if (query.at) {
      where.time = {
        lte: query.at,
      }
    }

    // 为每个 indicatorConfigId 只取一条最新记录（time 最大且 <= at）
    const groups = await this.client.indicatorValue.groupBy({
      by: ['indicatorConfigId'],
      where,
      _max: {
        time: true,
      },
    })

    if (!groups.length) return []

    const conditions = groups
      .filter(group => group._max.time)
      .map(group => ({
        indicatorConfigId: group.indicatorConfigId,
        time: group._max.time as Date,
      }))

    if (!conditions.length) return []

    return this.client.indicatorValue.findMany({
      where: {
        OR: conditions,
      },
      orderBy: { time: 'asc' },
    })
  }

  async findRecentBars(symbolId: string, timeframe: MarketTimeframe, limit: number): Promise<MarketBar[]> {
    return this.client.marketBar.findMany({
      where: { symbolId, timeframe },
      orderBy: { time: 'desc' },
      take: limit,
    })
  }
}
