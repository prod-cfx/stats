import type { MarketTimeframe } from '@ai/shared'
 
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class KlineRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findMany(params: {
    where: Prisma.FuturesPriceHistoryWhereInput
    orderBy: { timestamp: 'desc' }
    take: number
  }) {
    return this.txHost.tx.futuresPriceHistory.findMany(params)
  }

  async groupByTimestamp(params: {
    where: Prisma.FuturesPriceHistoryWhereInput
    orderBy: { timestamp: 'desc' }
    take: number
  }) {
    return this.txHost.tx.futuresPriceHistory.groupBy({
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
    return this.txHost.tx.$queryRaw(Prisma.sql`
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
