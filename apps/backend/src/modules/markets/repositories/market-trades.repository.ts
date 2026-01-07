import type { MarketTrade, Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export interface FindTradesOptions {
  exchange?: string
  instrumentType?: string
  symbol?: string
  baseAsset?: string
  quoteAsset?: string
  side?: string
  limit?: number
  offset?: number
  fromTimestamp?: bigint
  toTimestamp?: bigint
  orderBy?: 'asc' | 'desc'
}

@Injectable()
export class MarketTradesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询交易记录
   */
  async findTrades(options: FindTradesOptions): Promise<MarketTrade[]> {
    const where: Prisma.MarketTradeWhereInput = {}

    if (options.exchange) {
      where.exchange = options.exchange
    }

    if (options.instrumentType) {
      where.instrumentType = options.instrumentType
    }

    if (options.symbol) {
      where.symbol = options.symbol
    }

    if (options.baseAsset) {
      where.baseAsset = options.baseAsset
    }

    if (options.quoteAsset) {
      where.quoteAsset = options.quoteAsset
    }

    if (options.side) {
      where.side = options.side
    }

    if (options.fromTimestamp || options.toTimestamp) {
      where.tradeTimestamp = {}
      if (options.fromTimestamp) {
        where.tradeTimestamp.gte = options.fromTimestamp
      }
      if (options.toTimestamp) {
        where.tradeTimestamp.lte = options.toTimestamp
      }
    }

    return this.prisma.marketTrade.findMany({
      where,
      orderBy: {
        tradeTimestamp: options.orderBy ?? 'desc',
      },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    })
  }

  /**
   * 获取最新成交记录
   */
  async findLatestTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    limit = 50,
  ): Promise<MarketTrade[]> {
    return this.prisma.marketTrade.findMany({
      where: {
        exchange,
        instrumentType,
        symbol,
      },
      orderBy: {
        tradeTimestamp: 'desc',
      },
      take: limit,
    })
  }

  /**
   * 获取大额成交记录（按金额排序）
   */
  async findLargeTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    minValue: number,
    limit = 50,
  ): Promise<MarketTrade[]> {
    // 注意：这里需要计算 price * size，Prisma 不支持直接计算，需要在应用层过滤
    // 或者使用 raw query
    const trades = await this.prisma.marketTrade.findMany({
      where: {
        exchange,
        instrumentType,
        symbol,
      },
      orderBy: {
        tradeTimestamp: 'desc',
      },
      take: limit * 10, // 先取更多数据用于过滤
    })

    // 计算成交金额并过滤
    const tradesWithValue = trades
      .map(trade => ({
        ...trade,
        value: Number(trade.price) * Number(trade.size),
      }))
      .filter(trade => trade.value >= minValue)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)

    return tradesWithValue
  }

  /**
   * 统计交易记录数量
   */
  async countTrades(options: Omit<FindTradesOptions, 'limit' | 'offset' | 'orderBy'>): Promise<number> {
    const where: Prisma.MarketTradeWhereInput = {}

    if (options.exchange) {
      where.exchange = options.exchange
    }

    if (options.instrumentType) {
      where.instrumentType = options.instrumentType
    }

    if (options.symbol) {
      where.symbol = options.symbol
    }

    if (options.baseAsset) {
      where.baseAsset = options.baseAsset
    }

    if (options.quoteAsset) {
      where.quoteAsset = options.quoteAsset
    }

    if (options.side) {
      where.side = options.side
    }

    if (options.fromTimestamp || options.toTimestamp) {
      where.tradeTimestamp = {}
      if (options.fromTimestamp) {
        where.tradeTimestamp.gte = options.fromTimestamp
      }
      if (options.toTimestamp) {
        where.tradeTimestamp.lte = options.toTimestamp
      }
    }

    return this.prisma.marketTrade.count({ where })
  }

  /**
   * 删除过期的交易记录
   */
  async deleteOldTrades(beforeTimestamp: bigint): Promise<number> {
    const result = await this.prisma.marketTrade.deleteMany({
      where: {
        tradeTimestamp: {
          lt: beforeTimestamp,
        },
      },
    })

    return result.count
  }

  /**
   * 获取交易记录总数
   */
  async getTradeCount(): Promise<number> {
    return this.prisma.marketTrade.count()
  }

  /**
   * 获取最旧的交易记录时间戳
   */
  async getOldestTradeTimestamp(): Promise<bigint | null> {
    const oldest = await this.prisma.marketTrade.findFirst({
      orderBy: {
        tradeTimestamp: 'asc',
      },
      select: {
        tradeTimestamp: true,
      },
    })
    return oldest?.tradeTimestamp ?? null
  }
}


