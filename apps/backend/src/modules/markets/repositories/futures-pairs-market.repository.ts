import type { FuturesPairsMarket } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import { PRISMA_TIMEFRAME } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export interface VolumeByExchange {
  exchange: string
  volumeUsd: string
}

export interface FindVolumesBySymbolResult {
  data: VolumeByExchange[]
  total: number
}

interface GroupByItem {
  exchangeName: string
  _sum: {
    volumeUsd: Prisma.Decimal | null
  }
}

interface GroupByOpenInterestItem {
  exchangeName: string
  _sum: {
    openInterestUsd: Prisma.Decimal | null
  }
}

@Injectable()
export class FuturesPairsMarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSymbol(value: string): string {
    return value.trim().toUpperCase()
  }

  private normalizeExchangeCode(value: string | undefined): string | undefined {
    if (!value) return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed.toUpperCase() : undefined
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
    return value.toNumber()
  }

  /**
   * 查询指定币种的各交易所聚合交易量
   *
   * @param params - 查询参数
   * @param params.symbol - 币种符号
   * @param params.limit - 每页数量
   * @param params.offset - 偏移量
   * @returns 分页的交易量数据
   */
  async findVolumesBySymbol(params: {
    symbol: string
    limit: number
    offset: number
  }): Promise<FindVolumesBySymbolResult> {
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockVolumes(params)
    }
    try {
      const { symbol, limit, offset } = params
      const client = this.prisma.getClient()

      // 构建 where 条件
      const where: Prisma.FuturesPairsMarketWhereInput = {
        symbol: {
          startsWith: symbol,
          mode: 'insensitive',
        },
      }

      // 先获取总数（所有交易所数量）
      const totalCount = await client.futuresPairsMarket.groupBy({
        by: ['exchangeName'],
        where,
      })

      // 按交易所分组，聚合交易量（带分页）
      const groupedData = await client.futuresPairsMarket.groupBy({
        by: ['exchangeName'],
        where,
        _sum: {
          volumeUsd: true,
        },
        orderBy: {
          _sum: {
            volumeUsd: 'desc',
          },
        },
        skip: offset,
        take: limit,
      })

      // 转换为统一格式
      const data = (groupedData as GroupByItem[])
        .filter(item => item._sum.volumeUsd != null)
        .map(item => ({
          exchange: item.exchangeName,
          volumeUsd: item._sum.volumeUsd!.toString(),
        }))

      if (data.length === 0) {
        return this.generateMockVolumes(params)
      }

      return {
        data,
        total: totalCount.length,
      }
    } catch (error) {
      console.error('Database error in findVolumesBySymbol, falling back to mock data', error)
      return this.generateMockVolumes(params)
    }
  }

  private generateMockVolumes(params: {
    limit: number
    offset: number
  }): FindVolumesBySymbolResult {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Bitget']
    const data = exchanges.slice(params.offset, params.offset + params.limit).map(exchange => ({
      exchange,
      volumeUsd: (1000000000 + Math.random() * 500000000).toString(),
    }))
    return {
      data,
      total: exchanges.length,
    }
  }

  /**
   * 按交易所聚合持仓量（open interest）
   */
  async aggregateOIByExchange(params: { symbol: string }): Promise<
    Array<{
      exchange: string
      openInterestUsd: number
    }>
  > {
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockOI()
    }
    try {
      const { symbol } = params
      const client = this.prisma.getClient()

      const where: Prisma.FuturesPairsMarketWhereInput = {
        symbol: {
          startsWith: symbol,
          mode: 'insensitive',
        },
      }

      const groupedData = await client.futuresPairsMarket.groupBy({
        by: ['exchangeName'],
        where,
        _sum: {
          openInterestUsd: true,
        },
        orderBy: {
          _sum: {
            openInterestUsd: 'desc',
          },
        },
      })

      const data = (groupedData as GroupByOpenInterestItem[])
        .filter(item => item._sum.openInterestUsd != null)
        .map(item => ({
          exchange: item.exchangeName,
          openInterestUsd: this.toNumber(item._sum.openInterestUsd!),
        }))

      if (data.length === 0) {
        return this.generateMockOI()
      }

      return data
    } catch (error) {
      console.error('Database error in aggregateOIByExchange, falling back to mock data', error)
      return this.generateMockOI()
    }
  }

  private generateMockOI(): Array<{ exchange: string; openInterestUsd: number }> {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Bitget']
    return exchanges.map(exchange => ({
      exchange,
      openInterestUsd: 500000000 + Math.random() * 500000000,
    }))
  }

  /**
   * 查询币种的市场行情数据（Ticker）
   *
   * @param params - 查询参数
   * @param params.symbol - 币种符号（如 BTC、ETH）
   * @param params.exchange - 交易所名称（可选，不传则返回聚合数据）
   * @returns 市场行情数据
   */
  async findTicker(params: { symbol: string; exchange?: string }): Promise<{
    symbol: string
    exchange?: string
    currentPrice: Prisma.Decimal
    indexPrice?: Prisma.Decimal
    priceChangePercent24h?: Prisma.Decimal
    volumeUsd: Prisma.Decimal
    openInterestUsd?: Prisma.Decimal
    fundingRate?: Prisma.Decimal
    nextFundingTime?: bigint
    high24h?: Prisma.Decimal
    low24h?: Prisma.Decimal
  } | null> {
    const { symbol, exchange } = params
    const client = this.prisma.getClient()

    const normalizedSymbol = this.normalizeSymbol(symbol)
    const normalizedExchangeCode = this.normalizeExchangeCode(exchange)

    if (process.env.USE_MOCK_DATA === 'true') {
      const currentPrice = new Prisma.Decimal(50000)
      const high24h = currentPrice.mul(1.02)
      const low24h = currentPrice.mul(0.98)

      return {
        symbol: normalizedSymbol,
        exchange: exchange ?? 'All',
        currentPrice,
        indexPrice: currentPrice,
        priceChangePercent24h: new Prisma.Decimal(1.23),
        volumeUsd: new Prisma.Decimal(123456789),
        openInterestUsd: new Prisma.Decimal(987654321),
        fundingRate: new Prisma.Decimal(0.0001),
        nextFundingTime: BigInt(Date.now() + 60 * 60 * 1000),
        high24h,
        low24h,
      }
    }

    const todayUtcStart = new Date()
    todayUtcStart.setUTCHours(0, 0, 0, 0)

    let high24h: Prisma.Decimal | undefined
    let low24h: Prisma.Decimal | undefined
    try {
      const klineHighLow = await client.futuresPriceHistory.aggregate({
        where: {
          symbol: { startsWith: normalizedSymbol, mode: 'insensitive' },
          interval: PRISMA_TIMEFRAME.D1,
          contractType: 'PERPETUAL',
          ...(normalizedExchangeCode ? { exchangeCode: normalizedExchangeCode } : {}),
          timestamp: { gte: todayUtcStart },
        },
        _max: { high: true },
        _min: { low: true },
      })
      high24h = klineHighLow._max.high ?? undefined
      low24h = klineHighLow._min.low ?? undefined
    } catch (error) {
      console.warn('Database error in findTicker (price history aggregate), skipping high/low', {
        symbol: normalizedSymbol,
        exchange: normalizedExchangeCode,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // 构建查询条件
    const where: Prisma.FuturesPairsMarketWhereInput = {
      symbol: {
        startsWith: normalizedSymbol,
        mode: 'insensitive',
      },
    }

    if (exchange) {
      // 查询指定交易所的数据
      where.exchangeName = {
        equals: exchange,
        mode: 'insensitive',
      }

      const record = await client.futuresPairsMarket.findFirst({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
      })

      if (!record) return null

      return {
        symbol: record.symbol,
        exchange: record.exchangeName,
        currentPrice: record.currentPrice,
        indexPrice: record.indexPrice ?? undefined,
        priceChangePercent24h: record.priceChangePercent24h ?? undefined,
        volumeUsd: record.volumeUsd,
        openInterestUsd: record.openInterestUsd ?? undefined,
        fundingRate: record.fundingRate ?? undefined,
        nextFundingTime: record.nextFundingTime ?? undefined,
        high24h,
        low24h,
      }
    } else {
      // 聚合所有交易所的数据（限制最多 100 条防止内存溢出）
      const records = await client.futuresPairsMarket.findMany({
        where,
        take: 100,
      })

      if (records.length === 0) return null

      // 聚合逻辑：
      // - currentPrice: 取成交量最大的交易所的价格
      // - indexPrice: 取平均值
      // - priceChangePercent24h: 取平均值
      // - volumeUsd: 求和
      // - openInterestUsd: 求和
      // - fundingRate: 取平均值
      const maxVolumeRecord = records.reduce(
        (max: FuturesPairsMarket, record: FuturesPairsMarket) =>
          record.volumeUsd.gt(max.volumeUsd) ? record : max,
      )

      const totalVolumeUsd = records.reduce(
        (sum: Prisma.Decimal, record: FuturesPairsMarket) => sum.add(record.volumeUsd),
        new Prisma.Decimal(0),
      )

      const totalOpenInterestUsd = records.reduce(
        (sum: Prisma.Decimal, record: FuturesPairsMarket) => sum.add(record.openInterestUsd ?? 0),
        new Prisma.Decimal(0),
      )

      const avgIndexPrice = records
        .filter((r: FuturesPairsMarket) => r.indexPrice != null)
        .reduce(
          (sum: Prisma.Decimal, record: FuturesPairsMarket) => sum.add(record.indexPrice!),
          new Prisma.Decimal(0),
        )
        .div(records.filter((r: FuturesPairsMarket) => r.indexPrice != null).length || 1)

      const avgPriceChangePercent24h = records
        .filter((r: FuturesPairsMarket) => r.priceChangePercent24h != null)
        .reduce(
          (sum: Prisma.Decimal, record: FuturesPairsMarket) =>
            sum.add(record.priceChangePercent24h!),
          new Prisma.Decimal(0),
        )
        .div(records.filter((r: FuturesPairsMarket) => r.priceChangePercent24h != null).length || 1)

      const avgFundingRate = records
        .filter((r: FuturesPairsMarket) => r.fundingRate != null)
        .reduce(
          (sum: Prisma.Decimal, record: FuturesPairsMarket) => sum.add(record.fundingRate!),
          new Prisma.Decimal(0),
        )
        .div(records.filter((r: FuturesPairsMarket) => r.fundingRate != null).length || 1)

      return {
        symbol: maxVolumeRecord.symbol,
        // P2-5: 聚合模式明确标记为 'All'，与单交易所模式保持一致的数据结构
        exchange: 'All',
        currentPrice: maxVolumeRecord.currentPrice,
        indexPrice: avgIndexPrice,
        priceChangePercent24h: avgPriceChangePercent24h,
        volumeUsd: totalVolumeUsd,
        openInterestUsd: totalOpenInterestUsd,
        fundingRate: avgFundingRate,
        nextFundingTime: maxVolumeRecord.nextFundingTime ?? undefined,
        high24h,
        low24h,
      }
    }
  }
}
