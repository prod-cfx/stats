import type { MarketDataProvider } from '../interfaces/market-data-provider.interface'
import { ErrorCode } from '@ai/shared'
import type { OnApplicationBootstrap } from '@nestjs/common'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BinanceMarketDataProvider } from '../providers/binance-market-data.provider'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { HyperliquidMarketDataProvider } from '../providers/hyperliquid-market-data.provider'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { OkxMarketDataProvider } from '../providers/okx-market-data.provider'
import { normalizeExactCode, normalizeRequestedCode, toSymbolCode } from '../utils/market-symbol-code.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { MarketDataRepository } from './market-data.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { MarketDataService } from './market-data.service'

export type ExchangeId = 'binance' | 'okx' | 'hyperliquid'
export type MarketSymbolSupportStatus = 'supported' | 'refreshed_then_supported' | 'not_supported'

@Injectable()
export class MarketSymbolCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketSymbolCatalogService.name)
  private syncAllInProgress = false
  private readonly refreshInProgress = new Set<ExchangeId>()

  constructor(
    private readonly repository: MarketDataRepository,
    private readonly marketDataService: MarketDataService,
    private readonly binanceProvider: BinanceMarketDataProvider,
    private readonly okxProvider: OkxMarketDataProvider,
    private readonly hyperliquidProvider: HyperliquidMarketDataProvider,
  ) {}

  onApplicationBootstrap(): void {
    void this.runInitialSync()
  }

  async ensureExchangeSymbolAvailable(exchange: string, symbol: string): Promise<MarketSymbolSupportStatus> {
    const normalizedExchange = this.normalizeExchange(exchange)
    const normalizedSymbol = this.normalizeSymbol(symbol)
    if (await this.hasSupportedSymbol(normalizedExchange, normalizedSymbol)) {
      return 'supported'
    }

    try {
      await this.refreshExchangeSymbols(normalizedExchange, [normalizedSymbol])
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `event=market_symbol_catalog_refresh_failed exchange=${normalizedExchange} symbol=${normalizedSymbol} reason=${reason}`,
      )
      throw new DomainException('backtesting.symbol_support_temporarily_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: {
          exchange: normalizedExchange,
          symbol: normalizedSymbol,
          reasonMessage: reason,
        },
      })
    }

    return (await this.hasSupportedSymbol(normalizedExchange, normalizedSymbol))
      ? 'refreshed_then_supported'
      : 'not_supported'
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllExchangeSymbols(): Promise<void> {
    if (this.syncAllInProgress) return
    this.syncAllInProgress = true

    try {
      for (const exchange of ['binance', 'okx', 'hyperliquid'] as const) {
        await this.refreshExchangeSymbols(exchange)
      }
    } finally {
      this.syncAllInProgress = false
    }
  }

  private async runInitialSync(): Promise<void> {
    this.logger.log('event=market_symbol_catalog_initial_sync_started')
    try {
      await this.syncAllExchangeSymbols()
      this.logger.log('event=market_symbol_catalog_initial_sync_completed')
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      this.logger.error(`event=market_symbol_catalog_initial_sync_failed reason=${reason}`)
    }
  }

  async refreshExchangeSymbols(exchange: ExchangeId, symbols?: string[]): Promise<void> {
    if (this.refreshInProgress.has(exchange)) return
    this.refreshInProgress.add(exchange)

    try {
      const provider = this.getProvider(exchange)
      const providerSymbols = await provider.fetchSymbols(symbols)
      if (providerSymbols.length > 0) {
        await this.marketDataService.upsertSymbolsFromProvider(providerSymbols, provider.name.toUpperCase())
      }
      this.logger.log(
        `event=market_symbol_catalog_refreshed exchange=${exchange} count=${providerSymbols.length}`,
      )
    } finally {
      this.refreshInProgress.delete(exchange)
    }
  }

  private async hasSupportedSymbol(exchange: ExchangeId, symbol: string): Promise<boolean> {
    const found = await this.repository.findActiveSymbolByExchangeAndCodes(
      exchange.toUpperCase(),
      this.buildCodeCandidates(symbol),
    )
    return Boolean(found)
  }

  private normalizeExchange(exchange: string): ExchangeId {
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

  private normalizeSymbol(symbol: string): string {
    const normalized = normalizeExactCode(symbol)
    if (normalized) {
      return normalized
    }
    throw new DomainException('backtesting.symbol_check_invalid_symbol', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { symbol },
    })
  }

  private getProvider(exchange: ExchangeId): MarketDataProvider {
    if (exchange === 'okx') return this.okxProvider
    if (exchange === 'hyperliquid') return this.hyperliquidProvider
    return this.binanceProvider
  }

  private buildCodeCandidates(symbol: string): string[] {
    if (symbol.includes(':')) {
      return symbol.endsWith(':SPOT')
        ? [symbol, symbol.slice(0, -':SPOT'.length)]
        : [symbol]
    }

    return [symbol, normalizeRequestedCode(symbol), toSymbolCode(symbol, 'PERP')]
  }
}
