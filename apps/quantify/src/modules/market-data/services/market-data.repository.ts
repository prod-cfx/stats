import type { MarketTimeframe, QuantifyInstrumentType as InstrumentType, SymbolType } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, MarketBar, MarketQuote, Prisma, Symbol as PrismaSymbol } from '@/prisma/prisma.types'
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import { randomUUID } from 'node:crypto'
import { ErrorCode, SymbolStatus as PrismaSymbolStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe, reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { MarketSymbolNotFoundException } from '../exceptions'

interface IndicatorSnapshotRecord {
  field: string
  value: number
}

interface UpsertMarketBarByUniqueInput {
  symbolId: string
  timeframe: PrismaMarketTimeframe
  time: Date
  open: string
  high: string
  low: string
  close: string
  volume?: string
  quoteVolume?: string
  trades?: number
  source?: string
  isFinal: boolean
}

@Injectable()
export class MarketDataRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findSymbolOrThrow(symbol: string): Promise<{ id: string; code: string }> {
    const normalized = symbol.trim().toUpperCase()
    const found = await this.txHost.tx.symbol.findUnique({
      where: { code: normalized },
      select: { id: true, code: true },
    })

    if (!found) {
      throw new MarketSymbolNotFoundException({ symbol })
    }

    return found
  }

  async findRecentBars(symbol: string, timeframe: MarketTimeframe, limit: number): Promise<MarketBar[]> {
    const target = await this.findSymbolOrThrow(symbol)
    return this.findRecentBarsBySymbolId(target.id, timeframe, limit)
  }

  async findRecentBarsBySymbolId(symbolId: string, timeframe: MarketTimeframe, limit: number): Promise<MarketBar[]> {
    const prismaTimeframe = mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)

    const bars = await this.txHost.tx.marketBar.findMany({
      where: {
        symbolId,
        timeframe: prismaTimeframe,
      },
      orderBy: { time: 'desc' },
      take: limit,
    })

    return bars.reverse()
  }

  async findLatestBar(symbol: string, timeframe: MarketTimeframe): Promise<MarketBar | null> {
    const target = await this.findSymbolOrThrow(symbol)
    return this.findLatestBarBySymbolId(target.id, timeframe)
  }

  async findLatestBarBySymbolId(symbolId: string, timeframe: MarketTimeframe): Promise<MarketBar | null> {
    const prismaTimeframe = mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)
    return this.txHost.tx.marketBar.findFirst({
      where: {
        symbolId,
        timeframe: prismaTimeframe,
      },
      orderBy: { time: 'desc' },
    })
  }

  async findLatestQuote(symbol: string): Promise<MarketQuote | null> {
    const target = await this.findSymbolOrThrow(symbol)
    return this.txHost.tx.marketQuote.findFirst({
      where: { symbolId: target.id },
      orderBy: { eventTime: 'desc' },
    })
  }

  async findLatestIndicatorValues(
    symbol: string,
    timeframe: MarketTimeframe,
    fields: string[],
  ): Promise<IndicatorSnapshotRecord[]> {
    if (fields.length === 0) return []

    const target = await this.findSymbolOrThrow(symbol)
    const prismaTimeframe = mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)

    const configs = await this.txHost.tx.indicatorConfig.findMany({
      where: {
        symbolId: target.id,
        timeframe: prismaTimeframe,
        name: { in: fields },
        isEnabled: true,
      },
      select: { id: true, name: true },
    })

    if (configs.length === 0) return []

    const grouped = await this.txHost.tx.indicatorValue.groupBy({
      by: ['indicatorConfigId'],
      where: {
        indicatorConfigId: { in: configs.map(config => config.id) },
      },
      _max: { time: true },
    })

    const latestPairs = grouped
      .filter(item => item._max.time !== null)
      .map(item => ({
        indicatorConfigId: item.indicatorConfigId,
        time: item._max.time as Date,
      }))

    if (latestPairs.length === 0) return []

    const values = await this.txHost.tx.indicatorValue.findMany({
      where: {
        OR: latestPairs,
      },
      include: {
        config: {
          select: {
            name: true,
          },
        },
      },
    })

    const result: IndicatorSnapshotRecord[] = []
    for (const value of values) {
      if (value.valueNumeric === null) continue
      result.push({
        field: value.config.name,
        value: Number(value.valueNumeric),
      })
    }
    return result
  }

  async assertBarsAvailable(symbol: string, timeframe: MarketTimeframe, limit: number): Promise<void> {
    const bars = await this.findRecentBars(symbol, timeframe, limit)
    if (bars.length > 0) return

    throw new DomainException('Missing market bars', {
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { symbol, timeframe, limit },
    })
  }

  async listSymbols(where: Prisma.SymbolWhereInput, orderBy: Prisma.SymbolOrderByWithRelationInput, skip: number, take: number) {
    const [items, total] = await Promise.all([
      this.txHost.tx.symbol.findMany({ where, orderBy, skip, take }),
      this.txHost.tx.symbol.count({ where }),
    ])
    return { items, total }
  }

  async createSymbol(data: Prisma.SymbolCreateInput): Promise<PrismaSymbol> {
    return this.txHost.tx.symbol.create({ data })
  }

  async findSymbolByCode(code: string): Promise<PrismaSymbol | null> {
    return this.txHost.tx.symbol.findUnique({ where: { code } })
  }

  async findActiveSymbolByExchangeAndCodes(exchange: string, codes: string[]): Promise<PrismaSymbol | null> {
    return this.txHost.tx.symbol.findFirst({
      where: {
        exchange,
        status: PrismaSymbolStatus.ACTIVE,
        code: { in: codes },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async updateSymbol(code: string, data: Prisma.SymbolUpdateInput): Promise<PrismaSymbol> {
    return this.txHost.tx.symbol.update({ where: { code }, data })
  }

  async upsertSymbol(code: string, create: Prisma.SymbolCreateInput, update: Prisma.SymbolUpdateInput): Promise<void> {
    await this.txHost.tx.symbol.upsert({ where: { code }, create, update })
  }

  async findSymbolsByCodeIn(codes: string[]): Promise<Array<{ id: string; code: string }>> {
    return this.txHost.tx.symbol.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    })
  }

  async findBars(where: Prisma.MarketBarWhereInput, orderBy: Prisma.MarketBarOrderByWithRelationInput, take: number) {
    return this.txHost.tx.marketBar.findMany({ where, orderBy, take })
  }

  async upsertBar(
    where: Prisma.MarketBarWhereUniqueInput,
    create: Prisma.MarketBarCreateInput,
    update: Prisma.MarketBarUpdateInput,
  ): Promise<void> {
    await this.txHost.tx.marketBar.upsert({ where, create, update })
  }

  async upsertBarByUnique(input: UpsertMarketBarByUniqueInput): Promise<void> {
    const dbTimeframe = reverseMapTimeframe(input.timeframe)

    await this.txHost.tx.$executeRaw`
      INSERT INTO "market_bars" (
        "id",
        "symbol_id",
        "timeframe",
        "time",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "quote_volume",
        "trades",
        "source",
        "is_final"
      )
      VALUES (
        ${randomUUID()},
        ${input.symbolId},
        ${dbTimeframe}::"MarketTimeframe",
        ${input.time},
        ${input.open},
        ${input.high},
        ${input.low},
        ${input.close},
        ${input.volume ?? null},
        ${input.quoteVolume ?? null},
        ${input.trades ?? null},
        ${input.source ?? null},
        ${input.isFinal}
      )
      ON CONFLICT ("symbol_id", "timeframe", "time")
      DO UPDATE SET
        "open" = EXCLUDED."open",
        "high" = EXCLUDED."high",
        "low" = EXCLUDED."low",
        "close" = EXCLUDED."close",
        "volume" = EXCLUDED."volume",
        "quote_volume" = EXCLUDED."quote_volume",
        "trades" = EXCLUDED."trades",
        "source" = EXCLUDED."source",
        "is_final" = EXCLUDED."is_final",
        "updated_at" = NOW()
    `
  }

  async findLatestQuoteBySymbolId(symbolId: string): Promise<MarketQuote | null> {
    return this.txHost.tx.marketQuote.findFirst({
      where: { symbolId },
      orderBy: { eventTime: 'desc' },
    })
  }

  async createQuote(data: Prisma.MarketQuoteCreateInput): Promise<void> {
    await this.txHost.tx.marketQuote.create({ data })
  }

  /**
   * 查询活跃普通策略订阅（用于动态 symbol 采集）
   */
  async findActiveStrategySubscriptionsForSymbols(): Promise<Array<{
    strategyInstance?: {
      strategyTemplate?: { legs?: unknown } | null
    } | null
  }>> {
    try {
      return await this.txHost.tx.userStrategySubscription.findMany({
        where: { status: 'active' },
        select: {
          strategyInstance: {
            select: {
              strategyTemplate: { select: { legs: true } },
            },
          },
        },
      })
    } catch {
      return []
    }
  }

  /**
   * 查询活跃 LLM 策略订阅（用于动态 symbol 采集）
   */
  async findActiveLlmSubscriptionsForSymbols(): Promise<Array<{
    llmStrategyInstance?: {
      strategy?: { allowedSymbols?: unknown } | null
    } | null
  }>> {
    try {
      return await this.txHost.tx.userLlmStrategySubscription.findMany({
        where: { status: 'active' },
        select: {
          llmStrategyInstance: {
            select: {
              strategy: { select: { allowedSymbols: true } },
            },
          },
        },
      })
    } catch {
      return []
    }
  }
}
