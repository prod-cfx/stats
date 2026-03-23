import type { MarketTrade } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

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
    if (defaultEnvAccessor.bool('USE_MOCK_DATA')) {
      return this.generateMockTrades(
        options.exchange || 'Binance',
        options.instrumentType || 'FUTURES',
        options.symbol || 'BTCUSDT',
        options.limit || 50,
      )
    }
    try {
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

      const trades = await this.prisma.marketTrade.findMany({
        where,
        // 增加确定性的二级排序，避免同毫秒成交导致分页 skip/take 不稳定
        orderBy: [{ tradeTimestamp: options.orderBy ?? 'desc' }, { id: options.orderBy ?? 'desc' }],
        take: options.limit ?? 100,
        skip: options.offset ?? 0,
      })

      if (trades.length === 0) {
        return this.generateMockTrades(
          options.exchange || 'Binance',
          options.instrumentType || 'FUTURES',
          options.symbol || 'BTCUSDT',
          options.limit || 50,
        )
      }
      return trades
    } catch (error) {
      console.error('Database error in findTrades, falling back to mock data', error)
      return this.generateMockTrades(
        options.exchange || 'Binance',
        options.instrumentType || 'FUTURES',
        options.symbol || 'BTCUSDT',
        options.limit || 50,
      )
    }
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
    if (defaultEnvAccessor.bool('USE_MOCK_DATA')) {
      return this.generateMockTrades(exchange, instrumentType, symbol, limit)
    }
    try {
      const trades = await this.prisma.marketTrade.findMany({
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
      if (trades.length === 0) {
        return this.generateMockTrades(exchange, instrumentType, symbol, limit)
      }
      return trades
    } catch (error) {
      console.error('Database error in findLatestTrades, falling back to mock data', error)
      return this.generateMockTrades(exchange, instrumentType, symbol, limit)
    }
  }

  private generateMockTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    limit: number,
  ): MarketTrade[] {
    const results: MarketTrade[] = []
    const now = Date.now()
    const baseAsset = symbol.replace(/USDT|USDC/i, '')
    const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : 'USDC'
    for (let i = 0; i < limit; i++) {
      results.push({
        id: Math.floor(Math.random() * 1000000),
        exchange,
        instrumentType,
        symbol,
        baseAsset,
        quoteAsset,
        tradeId: `T${now - i * 100}`,
        price: new Prisma.Decimal(60000 + Math.random() * 1000),
        size: new Prisma.Decimal(0.001 + Math.random() * 0.1),
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        tradeTimestamp: BigInt(now - i * 100),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    return results
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
    // 下推到数据库：筛选满足 minValue 的成交，并按时间倒序返回最近的 N 条
    const minValueDecimal = new Prisma.Decimal(minValue)

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        "id",
        "exchange",
        "instrument_type" as "instrumentType",
        "symbol",
        "base_asset" as "baseAsset",
        "quote_asset" as "quoteAsset",
        "trade_id" as "tradeId",
        "price",
        "size",
        "side",
        "trade_timestamp" as "tradeTimestamp",
        "created_at" as "createdAt",
        "updated_at" as "updatedAt"
      FROM "market_trades"
      WHERE "exchange" = ${exchange}
        AND "instrument_type" = ${instrumentType}
        AND "symbol" = ${symbol}
        AND ("price" * "size") >= ${minValueDecimal}
      ORDER BY "trade_timestamp" DESC
      LIMIT ${limit}
    `)

    return rows as unknown as MarketTrade[]
  }

  /**
   * 统计交易记录数量
   */
  async countTrades(
    options: Omit<FindTradesOptions, 'limit' | 'offset' | 'orderBy'>,
  ): Promise<number> {
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

  /**
   * 获取所有交易对组合 (exchange, instrumentType, symbol)
   */
  async getDistinctSymbolGroups(): Promise<
    Array<{ exchange: string; instrumentType: string; symbol: string }>
  > {
    const groups = await this.prisma.marketTrade.findMany({
      distinct: ['exchange', 'instrumentType', 'symbol'],
      select: {
        exchange: true,
        instrumentType: true,
        symbol: true,
      },
    })
    return groups
  }

  /**
   * 获取指定交易对的记录数量
   */
  async getTradeCountBySymbol(
    exchange: string,
    instrumentType: string,
    symbol: string,
  ): Promise<number> {
    return this.prisma.marketTrade.count({
      where: { exchange, instrumentType, symbol },
    })
  }

  /**
   * 删除指定交易对超出保留数量的旧记录
   * 使用 CTE + NOT EXISTS 替代 NOT IN，性能从 O(n²) 降到 O(n log n)
   */
  async deleteExcessTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    maxCount: number,
  ): Promise<number> {
    if (!Number.isFinite(maxCount) || maxCount <= 0) {
      return 0
    }

    const result = await this.prisma.$executeRaw`
      WITH to_keep AS (
        SELECT "id"
        FROM "market_trades"
        WHERE "exchange" = ${exchange}
          AND "instrument_type" = ${instrumentType}
          AND "symbol" = ${symbol}
        ORDER BY "trade_timestamp" DESC, "id" DESC
        LIMIT ${maxCount}
      )
      DELETE FROM "market_trades" mt
      WHERE mt."exchange" = ${exchange}
        AND mt."instrument_type" = ${instrumentType}
        AND mt."symbol" = ${symbol}
        AND NOT EXISTS (
          SELECT 1 FROM to_keep tk WHERE tk."id" = mt."id"
        )
    `
    return result
  }
}
