import { Injectable } from '@nestjs/common'
import type { TakerBuySellVolume } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class TakerBuySellVolumeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 批量创建或更新 Taker Buy/Sell Volume 数据
   */
  async upsertMany(
    data: Array<{
      exchange: string
      symbol: string
      range: string
      timestamp: Date
      buyRatio: number
      sellRatio: number
      buyVolUsd: number
      sellVolUsd: number
      source?: string
    }>,
  ): Promise<number> {
    const client = this.prisma.getClient()

    // 使用 Promise.all 并行执行所有 upsert
    const results = await Promise.all(
      data.map(item =>
        client.takerBuySellVolume.upsert({
          where: {
            exchange_symbol_range_timestamp: {
              exchange: item.exchange,
              symbol: item.symbol,
              range: item.range,
              timestamp: item.timestamp,
            },
          },
          update: {
            buyRatio: item.buyRatio,
            sellRatio: item.sellRatio,
            buyVolUsd: item.buyVolUsd,
            sellVolUsd: item.sellVolUsd,
            updatedAt: new Date(),
          },
          create: {
            exchange: item.exchange,
            symbol: item.symbol,
            range: item.range,
            timestamp: item.timestamp,
            buyRatio: item.buyRatio,
            sellRatio: item.sellRatio,
            buyVolUsd: item.buyVolUsd,
            sellVolUsd: item.sellVolUsd,
            source: item.source ?? 'COINGLASS',
          },
        }),
      ),
    )

    return results.length
  }

  /**
   * 查询指定交易所和币种的最新 Taker Buy/Sell Volume 数据
   */
  async findLatest(params: {
    exchange: string
    symbol: string
    range: string
    limit?: number
  }): Promise<TakerBuySellVolume[]> {
    const client = this.prisma.getClient()

    return client.takerBuySellVolume.findMany({
      where: {
        exchange: params.exchange,
        symbol: params.symbol,
        range: params.range,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: params.limit ?? 100,
    })
  }

  /**
   * 查询所有交易所在指定币种和时间范围的最新数据
   */
  async findLatestBySymbol(params: {
    symbol: string
    range: string
  }): Promise<TakerBuySellVolume[]> {
    const client = this.prisma.getClient()

    // 为每个交易所获取最新的一条记录
    const latestTimestamp = await client.takerBuySellVolume.groupBy({
      by: ['exchange'],
      where: {
        symbol: params.symbol,
        range: params.range,
      },
      _max: {
        timestamp: true,
      },
    })

    if (latestTimestamp.length === 0) {
      return []
    }

    // 获取每个交易所最新时间点的数据
    return client.takerBuySellVolume.findMany({
      where: {
        symbol: params.symbol,
        range: params.range,
        OR: latestTimestamp.map(item => ({
          exchange: item.exchange,
          timestamp: item._max.timestamp!,
        })),
      },
      orderBy: [{ exchange: 'asc' }],
    })
  }
}
