import type { MarketTimeframe } from '@ai/shared'
import type { BacktestRunInput, Bar, Timeframe } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { getMarketTimeframeMs } from '@/modules/market-data/utils/market-timeframe.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'

type LoadBarsInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>
type CoverageInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>

export interface BacktestRangeCoverage {
  kind: 'full' | 'partial' | 'empty'
  availableRange?: { fromTs: number; toTs: number }
  appliedRange?: { fromTs: number; toTs: number }
}

@Injectable()
export class BacktestMarketDataService {
  constructor(private readonly prisma: PrismaService) {}

  async loadBars(input: LoadBarsInput): Promise<Bar[]> {
    const symbols = this.normalizeSymbols(input.symbols)
    const bars: Bar[] = []
    const symbolMap = await this.loadSymbolMap(symbols)
    const timeframes = [...new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes])]

    for (const symbol of symbols) {
      const symbolId = symbolMap.get(symbol)
      if (!symbolId) continue

      for (const timeframe of timeframes) {
        const prismaTimeframe = mapTimeframe(timeframe as MarketTimeframe)
        const timeframeMs = getMarketTimeframeMs(timeframe)
        const rows = await this.prisma.marketBar.findMany({
          where: {
            symbolId,
            timeframe: prismaTimeframe,
            time: {
              gte: new Date(input.dataRange.fromTs),
              lte: new Date(input.dataRange.toTs),
            },
          },
          orderBy: { time: 'asc' },
        })

        for (const row of rows) {
          const closeTime = row.time.getTime()
          bars.push({
            symbol,
            timeframe,
            openTime: closeTime - timeframeMs,
            closeTime,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: row.volume !== null ? Number(row.volume) : 0,
          })
        }
      }
    }

    return bars.sort((a, b) => a.closeTime - b.closeTime)
  }

  async resolveCoverage(input: CoverageInput): Promise<BacktestRangeCoverage> {
    const symbols = this.normalizeSymbols(input.symbols)
    const ranges: Array<{ fromTs: number; toTs: number }> = []
    const symbolMap = await this.loadSymbolMap(symbols)
    if (symbolMap.size < symbols.length) return { kind: 'empty' }

    const timeframes = [...new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes])]
    for (const symbol of symbols) {
      const symbolId = symbolMap.get(symbol)
      if (!symbolId) return { kind: 'empty' }

      for (const timeframe of timeframes) {
        const prismaTimeframe = mapTimeframe(timeframe as MarketTimeframe)
        const aggregate = await this.prisma.marketBar.aggregate({
          where: {
            symbolId,
            timeframe: prismaTimeframe,
          },
          _min: { time: true },
          _max: { time: true },
        })

        const from = aggregate._min.time
        const to = aggregate._max.time
        if (!from || !to) return { kind: 'empty' }
        ranges.push({ fromTs: from.getTime(), toTs: to.getTime() })
      }
    }

    if (ranges.length === 0) return { kind: 'empty' }

    const availableRange = {
      fromTs: Math.max(...ranges.map(item => item.fromTs)),
      toTs: Math.min(...ranges.map(item => item.toTs)),
    }
    if (availableRange.fromTs > availableRange.toTs) {
      return { kind: 'empty' }
    }

    const appliedRange = {
      fromTs: Math.max(input.dataRange.fromTs, availableRange.fromTs),
      toTs: Math.min(input.dataRange.toTs, availableRange.toTs),
    }
    if (appliedRange.fromTs > appliedRange.toTs) {
      return { kind: 'empty', availableRange }
    }

    if (appliedRange.fromTs === input.dataRange.fromTs && appliedRange.toTs === input.dataRange.toTs) {
      return { kind: 'full', availableRange, appliedRange }
    }

    return { kind: 'partial', availableRange, appliedRange }
  }

  private async loadSymbolMap(symbols: string[]): Promise<Map<string, string>> {
    const normalizedSymbols = symbols.map(symbol => symbol.trim().toUpperCase())
    const rows = await this.prisma.symbol.findMany({
      where: {
        code: { in: normalizedSymbols },
      },
      select: { id: true, code: true },
    })
    return new Map(rows.map(row => [row.code.toUpperCase(), row.id]))
  }

  private normalizeSymbols(symbols: string[]): string[] {
    return [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()))]
  }
}
