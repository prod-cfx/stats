import type { CreateOpenInterestDto } from './dto/open-interest.dto'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class OpenInterestRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async upsert(data: CreateOpenInterestDto) {
    return this.getClient().openInterest.upsert({
      where: {
        open_interest_exchange_symbol_data_timestamp_key: {
          exchange: data.exchange,
          symbol: data.symbol,
          dataTimestamp: new Date(data.data_timestamp),
        },
      },
      update: {
        openInterestUsd: data.open_interest_usd,
        openInterestQuantity: data.open_interest_quantity,
        openInterestByStableCoinMargin: data.open_interest_by_stable_coin_margin,
        openInterestByCoinMargin: data.open_interest_by_coin_margin,
        openInterestQuantityByCoinMargin: data.open_interest_quantity_by_coin_margin,
        openInterestQuantityByStableCoinMargin: data.open_interest_quantity_by_stable_coin_margin,
        openInterestChangePercent5m: data.open_interest_change_percent_5m,
        openInterestChangePercent15m: data.open_interest_change_percent_15m,
        openInterestChangePercent30m: data.open_interest_change_percent_30m,
        openInterestChangePercent1h: data.open_interest_change_percent_1h,
        openInterestChangePercent4h: data.open_interest_change_percent_4h,
        openInterestChangePercent24h: data.open_interest_change_percent_24h,
      },
      create: {
        exchange: data.exchange,
        symbol: data.symbol,
        openInterestUsd: data.open_interest_usd,
        openInterestQuantity: data.open_interest_quantity,
        openInterestByStableCoinMargin: data.open_interest_by_stable_coin_margin,
        openInterestByCoinMargin: data.open_interest_by_coin_margin,
        openInterestQuantityByCoinMargin: data.open_interest_quantity_by_coin_margin,
        openInterestQuantityByStableCoinMargin: data.open_interest_quantity_by_stable_coin_margin,
        openInterestChangePercent5m: data.open_interest_change_percent_5m,
        openInterestChangePercent15m: data.open_interest_change_percent_15m,
        openInterestChangePercent30m: data.open_interest_change_percent_30m,
        openInterestChangePercent1h: data.open_interest_change_percent_1h,
        openInterestChangePercent4h: data.open_interest_change_percent_4h,
        openInterestChangePercent24h: data.open_interest_change_percent_24h,
        dataTimestamp: new Date(data.data_timestamp),
      },
    })
  }

  async findMany(where: Prisma.OpenInterestWhereInput, take: number, skip: number) {
    return this.getClient().openInterest.findMany({
      where,
      orderBy: { dataTimestamp: 'desc' },
      take,
      skip,
    })
  }

  async count(where: Prisma.OpenInterestWhereInput) {
    return this.getClient().openInterest.count({ where })
  }

  async findLatest(exchange: string, symbol: string) {
    return this.getClient().openInterest.findFirst({
      where: { exchange, symbol },
      orderBy: { dataTimestamp: 'desc' },
    })
  }

  async queryRawStats(symbol: string, startTime: Date, endTime: Date) {
    interface StatsRow {
      min: Prisma.Decimal | null
      max: Prisma.Decimal | null
      avg: Prisma.Decimal | null
      data_points: bigint | null
      earliest: Prisma.Decimal | null
      latest: Prisma.Decimal | null
    }

    return this.getClient().$queryRaw(
      Prisma.sql`
      WITH aggregated AS (
        SELECT
          data_timestamp,
          CASE
            WHEN BOOL_OR(exchange = 'All') THEN
              SUM(CASE WHEN exchange = 'All' THEN open_interest_usd ELSE 0 END)
            ELSE
              SUM(open_interest_usd)
          END::numeric AS total_value
        FROM open_interest
        WHERE symbol = ${symbol}
          AND data_timestamp BETWEEN ${startTime} AND ${endTime}
        GROUP BY data_timestamp
      )
      SELECT
        MIN(total_value) AS min,
        MAX(total_value) AS max,
        AVG(total_value) AS avg,
        COUNT(*) AS data_points,
        (ARRAY_AGG(total_value ORDER BY data_timestamp ASC))[1] AS earliest,
        (ARRAY_AGG(total_value ORDER BY data_timestamp DESC))[1] AS latest
      FROM aggregated;
    `,
    ) as Promise<StatsRow[]>
  }
}
