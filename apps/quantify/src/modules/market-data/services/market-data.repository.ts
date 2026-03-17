import type { MarketTimeframe } from '@ai/shared'
import type { MarketBar, MarketQuote } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 PrismaService
import { PrismaService } from '@/prisma/prisma.service'
import { MarketSymbolNotFoundException } from '../exceptions'

interface IndicatorSnapshotRecord {
  field: string
  value: number
}

@Injectable()
export class MarketDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSymbolOrThrow(symbol: string): Promise<{ id: string; code: string }> {
    const normalized = symbol.trim().toUpperCase()
    const found = await this.prisma.symbol.findUnique({
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
    const prismaTimeframe = mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)

    const bars = await this.prisma.marketBar.findMany({
      where: {
        symbolId: target.id,
        timeframe: prismaTimeframe,
      },
      orderBy: { time: 'desc' },
      take: limit,
    })

    return bars.reverse()
  }

  async findLatestBar(symbol: string, timeframe: MarketTimeframe): Promise<MarketBar | null> {
    const target = await this.findSymbolOrThrow(symbol)
    const prismaTimeframe = mapTimeframe(timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)
    return this.prisma.marketBar.findFirst({
      where: {
        symbolId: target.id,
        timeframe: prismaTimeframe,
      },
      orderBy: { time: 'desc' },
    })
  }

  async findLatestQuote(symbol: string): Promise<MarketQuote | null> {
    const target = await this.findSymbolOrThrow(symbol)
    return this.prisma.marketQuote.findFirst({
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
}
