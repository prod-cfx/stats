import type { MarketTimeframe } from '@/prisma/prisma.types'
 
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class KlineRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findMany(params: {
    where: Prisma.FuturesPriceHistoryWhereInput
    orderBy: { timestamp: 'desc' }
    take: number
  }) {
    const client = this.getClient()
    return client.futuresPriceHistory.findMany(params)
  }

  async groupByTimestamp(params: {
    where: Prisma.FuturesPriceHistoryWhereInput
    orderBy: { timestamp: 'desc' }
    take: number
  }) {
    const client = this.getClient()
    return client.futuresPriceHistory.groupBy({
      by: ['timestamp'],
      where: params.where,
      _max: { high: true },
      _min: { low: true, open: true },
      _sum: { volumeUsd: true },
      orderBy: params.orderBy,
      take: params.take,
    })
  }

  async queryRawOpenClose(
    symbol: string,
    dbInterval: string,
    timestamps: Date[],
  ): Promise<{ timestamp: Date; open: number; close: number }[]> {
    const client = this.getClient()
    return client.$queryRaw(Prisma.sql`
      WITH ranked AS (
        SELECT
          timestamp,
          open,
          close,
          ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY exchange_code ASC) as rn_first,
          ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY exchange_code DESC) as rn_last
        FROM futures_price_history
        WHERE symbol = ${symbol}
          AND interval = ${dbInterval}
          AND timestamp IN (${Prisma.join(timestamps)})
      )
      SELECT
        timestamp,
        MAX(CASE WHEN rn_first = 1 THEN open END) as open,
        MAX(CASE WHEN rn_last = 1 THEN close END) as close
      FROM ranked
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `) as Promise<{ timestamp: Date; open: number; close: number }[]>
  }
}
