import type { MarketTimeframe } from '@ai/shared'
import type { BacktestRunInput, Bar, Timeframe } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'
import { normalizeExactCode, normalizeRequestedCode, toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
import { getMarketTimeframeMs } from '@/modules/market-data/utils/market-timeframe.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataRepository } from '../repositories/backtest-market-data.repository'

type LoadBarsInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>
type CoverageInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>

export interface BacktestRangeCoverage {
  kind: 'full' | 'partial' | 'empty'
  availableRange?: { fromTs: number; toTs: number }
  appliedRange?: { fromTs: number; toTs: number }
}

@Injectable()
export class BacktestMarketDataService {
  constructor(private readonly repository: BacktestMarketDataRepository) {}

  async loadBars(input: LoadBarsInput): Promise<Bar[]> {
    const symbols = this.normalizeSymbols(input.symbols)
    const bars: Bar[] = []
    const symbolMap = await this.loadSymbolMap(symbols)
    const timeframes = [...new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes])]

    for (const symbol of symbols) {
      const symbolId = symbolMap.get(symbol)
      if (!symbolId) continue

      for (const timeframe of timeframes) {
        const timeframeMs = getMarketTimeframeMs(timeframe)
        const rows = await this.repository.findBars({
          symbolId,
          timeframe: timeframe as MarketTimeframe,
          fromTs: input.dataRange.fromTs,
          toTs: input.dataRange.toTs,
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
        const aggregate = await this.repository.aggregateCoverage({
          symbolId,
          timeframe: timeframe as MarketTimeframe,
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
    const normalizedSymbols = symbols.map(symbol => normalizeExactCode(symbol))
    const codeCandidates = [...new Set(normalizedSymbols.flatMap(symbol => this.buildCodeCandidates(symbol)))]
    const rows = await this.repository.findSymbolsByCodes(codeCandidates)

    const rowMap = new Map(rows.map(row => [normalizeExactCode(row.code), row.id]))
    const result = new Map<string, string>()
    for (const symbol of normalizedSymbols) {
      const resolvedId = this.resolveSymbolId(symbol, rowMap)
      if (resolvedId) {
        result.set(symbol, resolvedId)
      }
    }
    return result
  }

  private normalizeSymbols(symbols: string[]): string[] {
    return [...new Set(symbols.map(symbol => normalizeExactCode(symbol)))]
  }

  private buildCodeCandidates(symbol: string): string[] {
    if (symbol.includes(':')) {
      return symbol.endsWith(':SPOT')
        ? [symbol, symbol.slice(0, -':SPOT'.length)]
        : [symbol]
    }

    return [symbol, toSymbolCode(symbol, 'PERP'), normalizeRequestedCode(symbol)]
  }

  private resolveSymbolId(symbol: string, rowMap: Map<string, string>): string | undefined {
    if (symbol.includes(':')) {
      if (rowMap.has(symbol)) {
        return rowMap.get(symbol)
      }
      if (symbol.endsWith(':SPOT')) {
        return rowMap.get(symbol.slice(0, -':SPOT'.length))
      }
      return undefined
    }

    return rowMap.get(normalizeRequestedCode(symbol))
      ?? rowMap.get(toSymbolCode(symbol, 'PERP'))
      ?? rowMap.get(symbol)
  }
}
