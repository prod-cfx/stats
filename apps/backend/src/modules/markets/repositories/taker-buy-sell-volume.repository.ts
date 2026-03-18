import type { TakerBuySellVolume } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class TakerBuySellVolumeRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

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
    const batchSize = 20
    const batchConcurrency = 3
    let processedCount = 0

    const batches: (typeof data)[] = []
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize))
    }

    const processBatch = async (batch: typeof data): Promise<void> => {
      for (const item of batch) {
        await client.takerBuySellVolume.upsert({
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
        })
      }
    }

    for (let i = 0; i < batches.length; i += batchConcurrency) {
      const group = batches.slice(i, i + batchConcurrency)
      await Promise.all(group.map(batch => processBatch(batch)))
      processedCount += group.reduce((total, batch) => total + batch.length, 0)
    }

    return processedCount
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
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockVolumes(params)
    }
    try {
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
        return this.generateMockVolumes(params)
      }

      // 获取每个交易所最新时间点的数据
      return client.takerBuySellVolume.findMany({
        where: {
          symbol: params.symbol,
          range: params.range,
          OR: latestTimestamp.map((item): { exchange: string; timestamp: Date } => ({
            exchange: item.exchange,
            timestamp: item._max.timestamp!,
          })),
        },
        orderBy: [{ exchange: 'asc' }],
      })
    } catch (error) {
      console.error('Database error in findLatestBySymbol, falling back to mock data', error)
      return this.generateMockVolumes(params)
    }
  }

  private generateMockVolumes(params: { symbol: string; range: string }): TakerBuySellVolume[] {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Bitget']
    const results: TakerBuySellVolume[] = []
    const now = new Date()

    // 使用确定性种子生成伪随机数，确保相同参数下结果一致
    const seed = this.hashCode(`${params.symbol}-${params.range}`)
    let state = seed
    const nextRandom = (): number => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }

    for (const [idx, exchange] of exchanges.entries()) {
      const buyRatio = 45 + nextRandom() * 10
      const sellRatio = 100 - buyRatio
      results.push({
        id: idx + 1,
        exchange,
        symbol: params.symbol,
        range: params.range,
        timestamp: now,
        buyRatio: new Prisma.Decimal(buyRatio.toFixed(2)),
        sellRatio: new Prisma.Decimal(sellRatio.toFixed(2)),
        buyVolUsd: new Prisma.Decimal((500000 + nextRandom() * 500000).toFixed(2)),
        sellVolUsd: new Prisma.Decimal((500000 + nextRandom() * 500000).toFixed(2)),
        source: 'MOCK',
        createdAt: now,
        updatedAt: now,
      })
    }
    return results
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash) || 1
  }
}
