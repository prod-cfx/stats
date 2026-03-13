import type { CryptoStockQuote, Prisma } from '@/prisma/prisma.types'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { SourceConsistencyException } from '@/common/exceptions/source-consistency.exception'
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
  mNav?: Decimal | string | number | null
  holdingValue?: Decimal | string | number | null
  holdingQuantity?: Decimal | string | number | null
  companyType?: string | null
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
  private readonly logger: Logger

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional() @Inject(Logger) logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(CryptoStockQuotesRepository.name)
  }

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
      mNav: input.mNav ?? null,
      holdingValue: input.holdingValue ?? null,
      holdingQuantity: input.holdingQuantity ?? null,
      companyType: input.companyType ?? null,
      source: input.source ?? 'BBX',
      quoteTimestamp: input.quoteTimestamp,
      rawData: input.rawData as Prisma.InputJsonValue,
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
      mNav: input.mNav ?? null,
      holdingValue: input.holdingValue ?? null,
      holdingQuantity: input.holdingQuantity ?? null,
      companyType: input.companyType ?? null,
      rawData: input.rawData as Prisma.InputJsonValue,
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
   * 批量创建或更新加密股票报价（快照模式）
   *
   * ⚠️ 警告：此方法会删除该source的所有旧记录，只保留本次抓取的快照数据。
   * 这是全量替换操作，不是增量更新。
   *
   * 每次调用会删除该source的所有旧记录，只保留本次抓取的快照数据。
   * 适用于BBX_SCRAPER等不需要历史数据累积的场景。
   */
  async upsertQuotes(inputs: CreateCryptoStockQuoteInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const source = inputs[0]?.source ?? 'BBX'

      const inconsistentSource = inputs.find(input => (input.source ?? 'BBX') !== source)
      if (inconsistentSource) {
        throw new SourceConsistencyException({
          expected: source,
          got: inconsistentSource.source ?? 'BBX',
        })
      }

      const deleteCount = await tx.cryptoStockQuote.count({ where: { source } })
      if (deleteCount > 0) {
        this.logger.log(
          `Snapshot mode: deleting ${deleteCount} existing records for source: ${source}`,
        )
      }

      await tx.cryptoStockQuote.deleteMany({
        where: {
          source,
        },
      })

      const createData = inputs.map(input => this.buildCreateData(input))
      await tx.cryptoStockQuote.createMany({
        data: createData,
      })

      return inputs.length
    })
  }

  /**
   * BBX_SCRAPER 专用：按 symbol 替换快照
   *
   * - 仅允许 source='BBX_SCRAPER'
   * - 同一轮 inputs 的 quoteTimestamp 必须一致
   * - 每个 symbol 仅删除该 symbol+source 的旧记录，再插入该 symbol 的新快照
   */
  async upsertBbxScraperQuotesBySymbolReplace(
    inputs: CreateCryptoStockQuoteInput[],
  ): Promise<number> {
    if (inputs.length === 0) {
      throw new Error('BBX_SCRAPER inputs cannot be empty.')
    }

    const source = inputs[0]?.source
    if (source !== 'BBX_SCRAPER') {
      throw new Error('BBX_SCRAPER source only.')
    }

    const inconsistentSource = inputs.find(input => input.source !== source)
    if (inconsistentSource) {
      throw new SourceConsistencyException({
        expected: source,
        got: inconsistentSource.source ?? 'UNKNOWN',
      })
    }

    const quoteTimestamp = inputs[0]?.quoteTimestamp
    const inconsistentTimestamp = inputs.find(
      input => input.quoteTimestamp.getTime() !== quoteTimestamp.getTime(),
    )
    if (inconsistentTimestamp) {
      throw new Error('BBX_SCRAPER quoteTimestamp must be consistent.')
    }

    const groupedBySymbol = new Map<string, CreateCryptoStockQuoteInput[]>()
    for (const input of inputs) {
      const group = groupedBySymbol.get(input.symbol)
      if (group) {
        group.push(input)
      } else {
        groupedBySymbol.set(input.symbol, [input])
      }
    }

    const startedAt = Date.now()
    const { createdCount, symbolCount } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let created = 0

        for (const [symbol, symbolInputs] of groupedBySymbol) {
          await tx.cryptoStockQuote.deleteMany({
            where: {
              source,
              symbol,
            },
          })

          const createData = symbolInputs.map(input => this.buildCreateData(input))
          if (createData.length > 0) {
            await tx.cryptoStockQuote.createMany({
              data: createData,
            })
            created += createData.length
          }
        }

        return {
          createdCount: created,
          symbolCount: groupedBySymbol.size,
        }
      },
    )

    const durationMs = Date.now() - startedAt
    this.logger.log(
      `BBX_SCRAPER replace by symbol: symbols=${symbolCount}, created=${createdCount}, durationMs=${durationMs}`,
    )

    return createdCount
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
        source: source ?? 'BBX_SCRAPER',
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
  async findLatestQuotesForSymbols(
    symbols: string[],
    source?: string,
  ): Promise<CryptoStockQuote[]> {
    if (!symbols.length) return []

    const client = this.getClient()

    const where: Prisma.CryptoStockQuoteWhereInput = {
      symbol: { in: symbols },
      source: source ?? 'BBX_SCRAPER',
    }

    return client.cryptoStockQuote.findMany({
      where,
      orderBy: [{ symbol: 'asc' }, { source: 'asc' }, { quoteTimestamp: 'desc' }],
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
      source: source ?? 'BBX_SCRAPER',
    }

    return client.cryptoStockQuote.findMany({
      where,
      orderBy: [{ symbol: 'asc' }, { source: 'asc' }, { quoteTimestamp: 'desc' }],
      distinct: ['symbol', 'source'],
    })
  }
}
