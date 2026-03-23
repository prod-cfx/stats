import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, IndicatorValue, MarketBar, MarketTimeframe, Prisma, IndicatorType as PrismaIndicatorType } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

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
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async upsertMany(values: IndicatorValueUpsertInput[]): Promise<void> {
    if (!values.length) return

    const client = this.txHost.tx

    for (const value of values) {
      await client.indicatorValue.upsert({
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
      })
    }
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

    return this.txHost.tx.indicatorValue.findMany({
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
    const groups = await this.txHost.tx.indicatorValue.groupBy({
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

    return this.txHost.tx.indicatorValue.findMany({
      where: {
        OR: conditions,
      },
      orderBy: { time: 'asc' },
    })
  }

  async findRecentBars(symbolId: string, timeframe: MarketTimeframe, limit: number): Promise<MarketBar[]> {
    return this.txHost.tx.marketBar.findMany({
      where: { symbolId, timeframe },
      orderBy: { time: 'desc' },
      take: limit,
    })
  }
}
