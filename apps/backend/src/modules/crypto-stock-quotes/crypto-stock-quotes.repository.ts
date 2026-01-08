import type { CryptoStockQuote, Prisma } from '@prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

type Decimal = Prisma.Decimal

export interface CreateCryptoStockQuoteInput {
  symbol: string
  name?: string | null
  exchange?: string | null
  price: Decimal | string | number
  openPrice?: Decimal | string | number | null
  highPrice?: Decimal | string | number | null
  lowPrice?: Decimal | string | number | null
  closePrice?: Decimal | string | number | null
  volume?: Decimal | string | number | null
  turnover?: Decimal | string | number | null
  priceChange?: Decimal | string | number | null
  priceChangePercent?: Decimal | string | number | null
  marketCap?: Decimal | string | number | null
  peRatio?: Decimal | string | number | null
  high52Week?: Decimal | string | number | null
  low52Week?: Decimal | string | number | null
  source?: string
  quoteTimestamp: Date
  rawData?: unknown
}

export interface QueryCryptoStockQuotesInput {
  symbol?: string
  source?: string
  startTime?: Date
  endTime?: Date
  limit?: number
}

@Injectable()
export class CryptoStockQuotesRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /**
   * 构建 Prisma 创建数据对象
   */
  private buildCreateData(input: CreateCryptoStockQuoteInput): Prisma.CryptoStockQuoteCreateInput {
    return {
      symbol: input.symbol,
      name: input.name ?? null,
      exchange: input.exchange ?? null,
      price: input.price,
      openPrice: input.openPrice ?? null,
      highPrice: input.highPrice ?? null,
      lowPrice: input.lowPrice ?? null,
      closePrice: input.closePrice ?? null,
      volume: input.volume ?? null,
      turnover: input.turnover ?? null,
      priceChange: input.priceChange ?? null,
      priceChangePercent: input.priceChangePercent ?? null,
      marketCap: input.marketCap ?? null,
      peRatio: input.peRatio ?? null,
      high52Week: input.high52Week ?? null,
      low52Week: input.low52Week ?? null,
      source: input.source ?? 'BBX',
      quoteTimestamp: input.quoteTimestamp,
      rawData: input.rawData as any,
    }
  }

  /**
   * 构建 Prisma 更新数据对象
   */
  private buildUpdateData(input: CreateCryptoStockQuoteInput): Prisma.CryptoStockQuoteUpdateInput {
    return {
      name: input.name ?? null,
      exchange: input.exchange ?? null,
      price: input.price,
      openPrice: input.openPrice ?? null,
      highPrice: input.highPrice ?? null,
      lowPrice: input.lowPrice ?? null,
      closePrice: input.closePrice ?? null,
      volume: input.volume ?? null,
      turnover: input.turnover ?? null,
      priceChange: input.priceChange ?? null,
      priceChangePercent: input.priceChangePercent ?? null,
      marketCap: input.marketCap ?? null,
      peRatio: input.peRatio ?? null,
      high52Week: input.high52Week ?? null,
      low52Week: input.low52Week ?? null,
      rawData: input.rawData as any,
    }
  }

  /**
   * 创建或更新加密股票报价记录
   */
  async upsertQuote(input: CreateCryptoStockQuoteInput): Promise<CryptoStockQuote> {
    const client = this.getClient()
    const source = input.source ?? 'BBX'

    return client.cryptoStockQuote.upsert({
      where: {
        symbol_source_quoteTimestamp: {
          symbol: input.symbol,
          source,
          quoteTimestamp: input.quoteTimestamp,
        },
      },
      create: this.buildCreateData(input),
      update: this.buildUpdateData(input),
    })
  }

  /**
   * 批量创建或更新加密股票报价
   */
  async upsertQuotes(inputs: CreateCryptoStockQuoteInput[]): Promise<number> {
    return this.prisma.runInTransaction(async tx => {
      let count = 0
      for (const input of inputs) {
        const source = input.source ?? 'BBX'
        await tx.cryptoStockQuote.upsert({
          where: {
            symbol_source_quoteTimestamp: {
              symbol: input.symbol,
              source,
              quoteTimestamp: input.quoteTimestamp,
            },
          },
          create: this.buildCreateData(input),
          update: this.buildUpdateData(input),
        })
        count += 1
      }
      return count
    })
  }

  /**
   * 查询加密股票报价记录
   */
  async findQuotes(query: QueryCryptoStockQuotesInput): Promise<CryptoStockQuote[]> {
    const client = this.getClient()

    const where: Prisma.CryptoStockQuoteWhereInput = {}

    if (query.symbol) {
      where.symbol = query.symbol
    }

    if (query.source) {
      where.source = query.source
    }

    if (query.startTime || query.endTime) {
      where.quoteTimestamp = {}
      if (query.startTime) {
        where.quoteTimestamp.gte = query.startTime
      }
      if (query.endTime) {
        where.quoteTimestamp.lte = query.endTime
      }
    }

    return client.cryptoStockQuote.findMany({
      where,
      orderBy: {
        quoteTimestamp: 'desc',
      },
      // 兜底：确保 limit 不超过 500，防止绕过上层校验
      take: Math.min(query.limit ?? 100, 500),
    })
  }

  /**
   * 查询最新的报价记录
   */
  async findLatestQuote(symbol: string, source?: string): Promise<CryptoStockQuote | null> {
    const client = this.getClient()

    return client.cryptoStockQuote.findFirst({
      where: {
        symbol,
        source: source ?? 'BBX',
      },
      orderBy: {
        quoteTimestamp: 'desc',
      },
    })
  }

  /**
   * 查询一组股票代码的最新报价记录
   *
   * - 对每个 symbol 返回一条最新记录（按 quoteTimestamp 降序）
   */
  async findLatestQuotesForSymbols(symbols: string[], source?: string): Promise<CryptoStockQuote[]> {
    if (!symbols.length) return []

    const client = this.getClient()

    const where: Prisma.CryptoStockQuoteWhereInput = {
      symbol: { in: symbols },
      source: source ?? 'BBX',
    }

    return client.cryptoStockQuote.findMany({
      where,
      orderBy: [
        { symbol: 'asc' },
        { source: 'asc' },
        { quoteTimestamp: 'desc' },
      ],
      distinct: ['symbol', 'source'],
    })
  }

  /**
   * 查询所有股票代码的最新报价记录
   *
   * - 对每个 (symbol, source) 组合返回一条最新记录
   */
  async findLatestQuotesForAllSymbols(source?: string): Promise<CryptoStockQuote[]> {
    const client = this.getClient()

    const where: Prisma.CryptoStockQuoteWhereInput = {
      source: source ?? 'BBX',
    }

    return client.cryptoStockQuote.findMany({
      where,
      orderBy: [
        { symbol: 'asc' },
        { source: 'asc' },
        { quoteTimestamp: 'desc' },
      ],
      distinct: ['symbol', 'source'],
    })
  }
}

