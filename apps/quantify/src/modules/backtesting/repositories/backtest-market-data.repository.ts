import type { MarketTimeframe } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import { SymbolStatus as PrismaSymbolStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'

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

      const quotes = await this.txHost.tx.marketQuote.findMany({
        where: {
          symbolId: symbol.id,
          bidPrice: { not: null },
          bidQty: { not: null },
          askPrice: { not: null },
          askQty: { not: null },
          eventTime: {
            gte: new Date(params.fromTs),
            lte: new Date(params.toTs),
          },
        },
        orderBy: { eventTime: 'desc' },
        take: Math.max(1, params.limit),
      })
      if (quotes.length > 0) return quotes.reverse()
    }

    return []
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
}
