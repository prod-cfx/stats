import type { MarketTimeframe } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { MarketQuote, PrismaClient } from '@/prisma/prisma.types'
import { SymbolStatus as PrismaSymbolStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { Prisma } from '@/prisma/prisma.types'

@Injectable()
export class BacktestMarketDataRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findSymbolsByCodes(codes: string[], exchange?: string | null) {
    return this.txHost.tx.symbol.findMany({
      where: {
        code: { in: codes },
        ...(exchange ? { exchange } : {}),
      },
      select: { id: true, code: true },
    })
  }

  findActiveSymbolByExchangeAndCodes(exchange: string, codes: string[]) {
    return this.txHost.tx.symbol.findFirst({
      where: {
        exchange,
        status: PrismaSymbolStatus.ACTIVE,
        code: { in: codes },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, code: true },
    })
  }

  findBars(params: {
    symbolId: string
    timeframe: MarketTimeframe
    fromTs: number
    toTs: number
  }) {
    return this.txHost.tx.marketBar.findMany({
      where: {
        symbolId: params.symbolId,
        timeframe: mapTimeframe(params.timeframe),
        time: {
          gte: new Date(params.fromTs),
          lte: new Date(params.toTs),
        },
      },
      orderBy: { time: 'asc' },
    })
  }

  async findHistoricalQuotes(params: {
    symbol: string
    fromTs: number
    toTs: number
    limit: number
  }) {
    const symbolCodes = this.buildSymbolCodeCandidates(params.symbol)
    const symbols = await this.txHost.tx.symbol.findMany({
      where: { code: { in: symbolCodes } },
      select: { id: true, code: true },
    })
    for (const code of symbolCodes) {
      const symbol = symbols.find(item => item.code === code)
      if (!symbol) continue

      const quotes = await this.findSampledHistoricalQuotes({
        symbolId: symbol.id,
        from: new Date(params.fromTs),
        to: new Date(params.toTs),
        limit: Math.max(1, params.limit),
      })
      if (quotes.length > 0) return quotes
    }

    return []
  }

  private findSampledHistoricalQuotes(params: {
    symbolId: string
    from: Date
    to: Date
    limit: number
  }): Promise<MarketQuote[]> {
    return this.txHost.tx.$queryRaw<MarketQuote[]>(Prisma.sql`
      WITH quote_minutes AS (
        SELECT generate_series(
          date_trunc('minute', ${params.from}::timestamp),
          date_trunc('minute', ${params.to}::timestamp),
          interval '1 minute'
        ) AS bucket_start
      )
      SELECT
        quote.id,
        quote.symbol_id AS "symbolId",
        quote.event_time AS "eventTime",
        quote.bid_price AS "bidPrice",
        quote.bid_qty AS "bidQty",
        quote.ask_price AS "askPrice",
        quote.ask_qty AS "askQty",
        quote.last_price AS "lastPrice",
        quote.price_change AS "priceChange",
        quote.price_change_percent AS "priceChangePercent",
        quote.open_price AS "openPrice",
        quote.high_price AS "highPrice",
        quote.low_price AS "lowPrice",
        quote.volume,
        quote.quote_volume AS "quoteVolume",
        quote.source,
        quote.created_at AS "createdAt"
      FROM quote_minutes minute
      JOIN LATERAL (
        SELECT *
        FROM market_quotes quote
        WHERE quote.symbol_id = ${params.symbolId}
          AND quote.bid_price IS NOT NULL
          AND quote.bid_qty IS NOT NULL
          AND quote.ask_price IS NOT NULL
          AND quote.ask_qty IS NOT NULL
          AND quote.event_time >= minute.bucket_start
          AND quote.event_time < minute.bucket_start + interval '1 minute'
        ORDER BY quote.event_time ASC
        LIMIT 1
      ) quote ON true
      ORDER BY minute.bucket_start ASC
      LIMIT ${params.limit}
    `)
  }

  private buildSymbolCodeCandidates(symbol: string): string[] {
    const normalized = symbol.trim().toUpperCase()
    if (!normalized) return []
    if (normalized.includes(':')) return [normalized]
    return [normalized, `${normalized}:PERP`, `${normalized}:SPOT`]
  }

  aggregateCoverage(params: {
    symbolId: string
    timeframe: MarketTimeframe
  }) {
    return this.txHost.tx.marketBar.aggregate({
      where: {
        symbolId: params.symbolId,
        timeframe: mapTimeframe(params.timeframe),
      },
      _min: { time: true },
      _max: { time: true },
    })
  }

  aggregateCoverageInRange(params: {
    symbolId: string
    timeframe: MarketTimeframe
    fromTs: number
    toTs: number
  }) {
    return this.txHost.tx.marketBar.aggregate({
      where: {
        symbolId: params.symbolId,
        timeframe: mapTimeframe(params.timeframe),
        time: {
          gte: new Date(params.fromTs),
          lte: new Date(params.toTs),
        },
      },
      _count: { _all: true },
      _min: { time: true },
      _max: { time: true },
    })
  }
}
