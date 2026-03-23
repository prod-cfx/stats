import type { MarketTimeframe } from '@ai/shared'
import type { InstrumentType, MarketBar, MarketQuote, Prisma, Symbol as PrismaSymbol, SymbolType } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 PrismaService
import { PrismaService } from '@/prisma/prisma.service'
import { SymbolStatus as PrismaSymbolStatus } from '@/prisma/prisma.types'
import { MarketSymbolNotFoundException } from '../exceptions'

interface IndicatorSnapshotRecord {
  field: string
  value: number
}

@Injectable()
export class MarketDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() { return this.prisma.getClient() }

  async findSymbolOrThrow(symbol: string): Promise<{ id: string; code: string }> {
    const normalized = symbol.trim().toUpperCase()
    const found = await this.getClient().symbol.findUnique({
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

    const bars = await this.getClient().marketBar.findMany({
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
    return this.getClient().marketBar.findFirst({
      where: {
        symbolId,
        timeframe: prismaTimeframe,
      },
      orderBy: { time: 'desc' },
    })
  }

  async findLatestQuote(symbol: string): Promise<MarketQuote | null> {
    const target = await this.findSymbolOrThrow(symbol)
    return this.getClient().marketQuote.findFirst({
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

    const configs = await this.prisma.indicatorConfig.findMany({
      where: {
        symbolId: target.id,
        timeframe: prismaTimeframe,
        name: { in: fields },
        isEnabled: true,
      },
      select: { id: true, name: true },
    })

    if (configs.length === 0) return []

    const grouped = await this.prisma.indicatorValue.groupBy({
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

    const values = await this.prisma.indicatorValue.findMany({
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
      this.getClient().symbol.findMany({ where, orderBy, skip, take }),
      this.getClient().symbol.count({ where }),
    ])
    return { items, total }
  }

  async createSymbol(data: Prisma.SymbolCreateInput): Promise<PrismaSymbol> {
    return this.getClient().symbol.create({ data })
  }

  async findSymbolByCode(code: string): Promise<PrismaSymbol | null> {
    return this.getClient().symbol.findUnique({ where: { code } })
  }

  async updateSymbol(code: string, data: Prisma.SymbolUpdateInput): Promise<PrismaSymbol> {
    return this.getClient().symbol.update({ where: { code }, data })
  }

  async upsertSymbol(code: string, create: Prisma.SymbolCreateInput, update: Prisma.SymbolUpdateInput): Promise<void> {
    await this.getClient().symbol.upsert({ where: { code }, create, update })
  }

  async findSymbolsByCodeIn(codes: string[]): Promise<Array<{ id: string; code: string }>> {
    return this.getClient().symbol.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    })
  }

  async findBars(where: Prisma.MarketBarWhereInput, orderBy: Prisma.MarketBarOrderByWithRelationInput, take: number) {
    return this.getClient().marketBar.findMany({ where, orderBy, take })
  }

  async upsertBar(
    where: Prisma.MarketBarWhereUniqueInput,
    create: Prisma.MarketBarCreateInput,
    update: Prisma.MarketBarUpdateInput,
  ): Promise<void> {
    await this.getClient().marketBar.upsert({ where, create, update })
  }

  async findLatestQuoteBySymbolId(symbolId: string): Promise<MarketQuote | null> {
    return this.getClient().marketQuote.findFirst({
      where: { symbolId },
      orderBy: { eventTime: 'desc' },
    })
  }

  async createQuote(data: Prisma.MarketQuoteCreateInput): Promise<void> {
    await this.getClient().marketQuote.create({ data })
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
      return await this.getClient().userStrategySubscription.findMany({
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
      return await this.getClient().userLlmStrategySubscription.findMany({
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
