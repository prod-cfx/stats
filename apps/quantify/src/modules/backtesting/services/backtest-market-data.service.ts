import type { MarketTimeframe } from '@ai/shared'
import type { MarketDataProvider, ProviderSymbol } from '@/modules/market-data/interfaces/market-data-provider.interface'
import type { BacktestRunInput, Bar, Timeframe } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { BinanceMarketDataProvider } from '@/modules/market-data/providers/binance-market-data.provider'
import { HyperliquidMarketDataProvider } from '@/modules/market-data/providers/hyperliquid-market-data.provider'
import { OkxMarketDataProvider } from '@/modules/market-data/providers/okx-market-data.provider'
import { MarketDataService } from '@/modules/market-data/services/market-data.service'
import {
  instrumentTypeToMarket,
  normalizeExactCode,
  normalizeRequestedCode,
  toSymbolCode,
} from '@/modules/market-data/utils/market-symbol-code.util'
import { getMarketTimeframeMs } from '@/modules/market-data/utils/market-timeframe.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataRepository } from '../repositories/backtest-market-data.repository'

type LoadBarsInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>
type CoverageInput = Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange'>
type SupportedExchange = 'binance' | 'okx' | 'hyperliquid'

export interface BacktestRangeCoverage {
  kind: 'full' | 'partial' | 'empty'
  availableRange?: { fromTs: number; toTs: number }
  appliedRange?: { fromTs: number; toTs: number }
}

@Injectable()
export class BacktestMarketDataService {
  private static readonly DEFAULT_BACKFILL_BATCH_SIZE = 500

  constructor(
    private readonly repository: BacktestMarketDataRepository,
    private readonly marketDataService: MarketDataService,
    private readonly binanceProvider: BinanceMarketDataProvider,
    private readonly okxProvider: OkxMarketDataProvider,
    private readonly hyperliquidProvider: HyperliquidMarketDataProvider,
  ) {}

  async prepareData(input: Pick<BacktestRunInput, 'symbols' | 'baseTimeframe' | 'stateTimeframes' | 'dataRange' | 'strategy'>): Promise<void> {
    const exchange = this.extractExchange(input.strategy.params)
    if (!exchange) return

    const normalizedSymbols = this.normalizeSymbols(input.symbols)
    if (normalizedSymbols.length === 0) return

    const provider = this.getProvider(exchange)
    const providerSymbols = await provider.fetchSymbols(normalizedSymbols)
    if (providerSymbols.length === 0) {
      throw new DomainException('backtest.symbol_not_supported', {
        code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
        status: HttpStatus.BAD_REQUEST,
        args: { exchange, symbols: normalizedSymbols },
      })
    }

    await this.marketDataService.upsertSymbolsFromProvider(providerSymbols, provider.name.toUpperCase())

    const targetSymbols = this.resolveProviderBackfillSymbols(normalizedSymbols, providerSymbols)
    const targetTimeframes = [...new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes])]
    for (const symbol of targetSymbols) {
      for (const timeframe of targetTimeframes) {
        await this.backfillHistoricalBars(provider, symbol, timeframe, input.dataRange)
      }
    }
  }

  async ensureSymbolSupported(exchange: string, symbol: string): Promise<'refreshed_then_supported' | 'not_supported'> {
    const normalizedExchange = this.normalizeExchange(exchange)
    const normalizedSymbol = normalizeExactCode(symbol)
    if (!normalizedSymbol) {
      throw new DomainException('backtesting.symbol_check_invalid_symbol', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { symbol },
      })
    }

    const provider = this.getProvider(normalizedExchange)
    const providerSymbols = await provider.fetchSymbols([normalizedSymbol])
    if (providerSymbols.length === 0) {
      return 'not_supported'
    }

    await this.marketDataService.upsertSymbolsFromProvider(providerSymbols, provider.name.toUpperCase())
    return 'refreshed_then_supported'
  }

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

  private extractExchange(params: Record<string, unknown>): SupportedExchange | null {
    if (typeof params.exchange !== 'string') return null
    try {
      return this.normalizeExchange(params.exchange)
    } catch {
      return null
    }
  }

  private normalizeExchange(exchange: string): SupportedExchange {
    const normalized = exchange.trim().toLowerCase()
    if (normalized === 'binance' || normalized === 'okx' || normalized === 'hyperliquid') {
      return normalized
    }
    throw new DomainException('backtesting.symbol_check_invalid_exchange', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { exchange },
    })
  }

  private getProvider(exchange: SupportedExchange): MarketDataProvider {
    if (exchange === 'okx') return this.okxProvider
    if (exchange === 'hyperliquid') return this.hyperliquidProvider
    return this.binanceProvider
  }

  private resolveProviderBackfillSymbols(symbols: string[], providerSymbols: ProviderSymbol[]): string[] {
    const availableMarketsByRaw = new Map<string, Set<'SPOT' | 'PERP'>>()
    for (const item of providerSymbols) {
      const raw = normalizeExactCode(item.symbol)
      const market = instrumentTypeToMarket(item.instrumentType)
      const current = availableMarketsByRaw.get(raw) ?? new Set<'SPOT' | 'PERP'>()
      current.add(market)
      availableMarketsByRaw.set(raw, current)
    }

    return symbols.map((symbol) => {
      if (symbol.includes(':')) return symbol
      const availableMarkets = availableMarketsByRaw.get(symbol)
      if (availableMarkets?.has('SPOT')) return toSymbolCode(symbol, 'SPOT')
      if (availableMarkets?.has('PERP')) return toSymbolCode(symbol, 'PERP')
      return normalizeRequestedCode(symbol)
    })
  }

  private async backfillHistoricalBars(
    provider: MarketDataProvider,
    symbol: string,
    timeframe: Timeframe,
    range: { fromTs: number; toTs: number },
  ): Promise<void> {
    const timeframeMs = getMarketTimeframeMs(timeframe)
    const maxIterations = Math.ceil(
      Math.max(range.toTs - range.fromTs, timeframeMs) / (timeframeMs * BacktestMarketDataService.DEFAULT_BACKFILL_BATCH_SIZE),
    ) + 2
    let cursor = new Date(range.fromTs)

    for (let i = 0; i < maxIterations; i += 1) {
      const bars = await provider.fetchHistoricalBars({
        symbol,
        timeframe: timeframe as MarketTimeframe,
        start: cursor,
        end: new Date(range.toTs),
        limit: BacktestMarketDataService.DEFAULT_BACKFILL_BATCH_SIZE,
      })

      if (bars.length === 0) break

      for (const bar of bars) {
        if (bar.timestamp < range.fromTs || bar.timestamp > range.toTs) continue
        await this.marketDataService.saveBarFromProvider(bar)
      }

      const nextCursorMs = (bars[bars.length - 1]?.timestamp ?? 0) + timeframeMs
      if (nextCursorMs <= cursor.getTime() || nextCursorMs > range.toTs) {
        break
      }
      cursor = new Date(nextCursorMs)
    }
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
