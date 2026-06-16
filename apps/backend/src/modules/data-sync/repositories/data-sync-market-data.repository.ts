import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'

export interface PairsMarketPointInput {
  instrument_id: string
  exchange_name: string
  symbol: string
  current_price: number
  index_price?: number
  price_change_percent_24h?: number
  volume_usd: number
  volume_usd_change_percent_24h?: number
  long_volume_usd?: number
  short_volume_usd?: number
  long_volume_quantity?: number
  short_volume_quantity?: number
  open_interest_quantity?: number
  open_interest_usd?: number
  open_interest_change_percent_24h?: number
  long_liquidation_usd_24h?: number
  short_liquidation_usd_24h?: number
  funding_rate?: number
  next_funding_time?: number
  open_interest_volume_radio?: number
  oi_vol_ratio_change_percent_24h?: number
}

export interface PairsMarketUpsertResult {
  upsertedCount: number
  failedCount: number
  failures: Array<{
    point: PairsMarketPointInput
    reason: unknown
  }>
}

export interface FuturesPriceHistoryCreateManyData {
  symbol: string
  exchangeCode: string
  contractType: string | null
  interval: string
  timestamp: Date
  open: string
  high: string
  low: string
  close: string
  volumeUsd: string
  source: string
}

export interface CoinsPriceChangeUpsertData {
  currentPrice: string
  priceChangePercent5m: string | null
  priceChangePercent15m: string | null
  priceChangePercent30m: string | null
  priceChangePercent1h: string | null
  priceChangePercent4h: string | null
  priceChangePercent12h: string | null
  priceChangePercent24h: string | null
  priceAmplitudePercent5m: string | null
  priceAmplitudePercent15m: string | null
  priceAmplitudePercent30m: string | null
  priceAmplitudePercent1h: string | null
  priceAmplitudePercent4h: string | null
  priceAmplitudePercent12h: string | null
  priceAmplitudePercent24h: string | null
  dataTimestamp: Date
}

export interface CoinsPriceChangeUpsertInput {
  symbol: string
  data: CoinsPriceChangeUpsertData
}

export interface CoinsPriceChangeUpsertResult {
  upsertedCount: number
  failedCount: number
  failures: Array<{
    point: CoinsPriceChangeUpsertInput
    reason: unknown
  }>
}

@Injectable()
export class DataSyncMarketDataRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async upsertPairsMarkets(
    points: PairsMarketPointInput[],
    now: Date,
    batchSize = 10,
  ): Promise<PairsMarketUpsertResult> {
    let upsertedCount = 0
    const failures: PairsMarketUpsertResult['failures'] = []

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (point) => {
          await this.txHost.tx.futuresPairsMarket.upsert({
            where: {
              symbol_exchangeName_instrumentId: {
                symbol: point.symbol,
                exchangeName: point.exchange_name,
                instrumentId: point.instrument_id,
              },
            },
            update: this.toPairsMarketWriteData(point, now),
            create: {
              exchangeName: point.exchange_name,
              instrumentId: point.instrument_id,
              symbol: point.symbol,
              ...this.toPairsMarketWriteData(point, now),
              source: 'COINGLASS',
            },
          })
          return point
        }),
      )

      for (let j = 0; j < results.length; j += 1) {
        const result = results[j]
        if (result.status === 'fulfilled') {
          upsertedCount += 1
        } else {
          failures.push({ point: batch[j], reason: result.reason })
        }
      }
    }

    return {
      upsertedCount,
      failedCount: failures.length,
      failures,
    }
  }

  async findEarliestFuturesPriceHistory(params: {
    symbol: string
    exchangeCode: string
    contractType: string | null
    interval: string
    source: string
  }): Promise<{ timestamp: Date } | null> {
    return this.txHost.tx.futuresPriceHistory.findFirst({
      where: params as Prisma.FuturesPriceHistoryWhereInput,
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    })
  }

  async createFuturesPriceHistoryMany(
    rows: FuturesPriceHistoryCreateManyData[],
  ): Promise<number> {
    const result = await this.txHost.tx.futuresPriceHistory.createMany({
      data: rows as Prisma.FuturesPriceHistoryCreateManyInput[],
      skipDuplicates: true,
    })
    return result.count
  }

  async findFuturesPriceHistoryTimestamps(params: {
    symbol: string
    exchangeCode: string
    contractType: string | null
    interval: string
    from: Date
    to: Date
    cursor?: Date
    take: number
  }): Promise<Array<{ timestamp: Date }>> {
    return this.txHost.tx.futuresPriceHistory.findMany({
      where: {
        symbol: params.symbol,
        exchangeCode: params.exchangeCode,
        contractType: params.contractType,
        interval: params.interval as never,
        source: 'COINGLASS',
        timestamp: params.cursor
          ? { gt: params.cursor, lte: params.to }
          : { gte: params.from, lte: params.to },
      },
      orderBy: { timestamp: 'asc' },
      take: params.take,
      select: { timestamp: true },
    })
  }

  async createLongShortRatioMany(rows: Prisma.LongShortRatioCreateManyInput[]): Promise<number> {
    const result = await this.txHost.tx.longShortRatio.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  async createHyperliquidWhaleAlertsMany(rows: Prisma.HyperliquidWhaleAlertCreateManyInput[]): Promise<number> {
    const result = await this.txHost.tx.hyperliquidWhaleAlert.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  async upsertHyperliquidWhalePosition(params: {
    userAddress: string
    symbol: string
    data: Prisma.HyperliquidWhalePositionUncheckedUpdateInput
  }): Promise<void> {
    await this.txHost.tx.hyperliquidWhalePosition.upsert({
      where: {
        userAddress_symbol: {
          userAddress: params.userAddress,
          symbol: params.symbol,
        },
      },
      update: params.data,
      create: {
        userAddress: params.userAddress,
        symbol: params.symbol,
        ...params.data,
      } as Prisma.HyperliquidWhalePositionUncheckedCreateInput,
    })
  }

  async createHyperliquidUserFundingMany(rows: Prisma.HyperliquidUserFundingCreateManyInput[]): Promise<number> {
    const result = await this.txHost.tx.hyperliquidUserFunding.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  async createHyperliquidUserFillsMany(rows: Prisma.HyperliquidUserFillCreateManyInput[]): Promise<number> {
    const result = await this.txHost.tx.hyperliquidUserFill.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  async createHyperliquidUserOrdersMany(rows: Prisma.HyperliquidUserOrderCreateManyInput[]): Promise<number> {
    const result = await this.txHost.tx.hyperliquidUserOrder.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  async upsertCoinsPriceChanges(
    points: CoinsPriceChangeUpsertInput[],
    now: Date,
    batchSize = 10,
  ): Promise<CoinsPriceChangeUpsertResult> {
    let upsertedCount = 0
    const failures: CoinsPriceChangeUpsertResult['failures'] = []

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (point) => {
          await this.txHost.tx.coinsPriceChange.upsert({
            where: {
              symbol_source: {
                symbol: point.symbol.toUpperCase(),
                source: 'COINGLASS',
              },
            },
            update: {
              ...point.data,
              updatedAt: now,
            },
            create: {
              symbol: point.symbol.toUpperCase(),
              source: 'COINGLASS',
              ...point.data,
            },
          })
          return point
        }),
      )

      for (let j = 0; j < results.length; j += 1) {
        const result = results[j]
        if (result.status === 'fulfilled') {
          upsertedCount += 1
        } else {
          failures.push({ point: batch[j], reason: result.reason })
        }
      }
    }

    return { upsertedCount, failedCount: failures.length, failures }
  }

  async createAggregatedLiquidationHistoryMany(
    rows: Prisma.AggregatedLiquidationHistoryCreateManyInput[],
  ): Promise<number> {
    const result = await this.txHost.tx.aggregatedLiquidationHistory.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  private toPairsMarketWriteData(point: PairsMarketPointInput, now: Date) {
    return {
      currentPrice: point.current_price.toString(),
      indexPrice: point.index_price?.toString(),
      priceChangePercent24h: point.price_change_percent_24h?.toString(),
      volumeUsd: point.volume_usd.toString(),
      volumeUsdChangePercent24h: point.volume_usd_change_percent_24h?.toString(),
      longVolumeUsd: point.long_volume_usd?.toString(),
      shortVolumeUsd: point.short_volume_usd?.toString(),
      longVolumeQuantity: point.long_volume_quantity?.toString(),
      shortVolumeQuantity: point.short_volume_quantity?.toString(),
      openInterestQuantity: point.open_interest_quantity?.toString(),
      openInterestUsd: point.open_interest_usd?.toString(),
      openInterestChangePercent24h: point.open_interest_change_percent_24h?.toString(),
      longLiquidationUsd24h: point.long_liquidation_usd_24h?.toString(),
      shortLiquidationUsd24h: point.short_liquidation_usd_24h?.toString(),
      fundingRate: point.funding_rate?.toString(),
      nextFundingTime: point.next_funding_time ? BigInt(point.next_funding_time) : null,
      openInterestVolumeRatio: point.open_interest_volume_radio?.toString(),
      oiVolRatioChangePercent24h: point.oi_vol_ratio_change_percent_24h?.toString(),
      updatedAt: now,
    }
  }
}
