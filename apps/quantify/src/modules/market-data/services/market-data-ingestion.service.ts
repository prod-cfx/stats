import type { MarketBarPayload, MarketQuotePayload, MarketTimeframe } from '@ai/shared'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { MarketDataProvider } from '../interfaces/market-data-provider.interface'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'
import { MARKET_DATA_LOG_CONTEXT, MARKET_DATA_PROVIDER } from '../constants/market-data.constants'
import { normalizeExactCode, toSymbolCode } from '../utils/market-symbol-code.util'
import { getMarketTimeframeMs } from '../utils/market-timeframe.util'
import { MarketDataStreamService } from './market-data-stream.service'
import { MarketDataService } from './market-data.service'

interface MarketDataRuntimeConfig {
  provider: string
  restBaseUrl: string
  wsBaseUrl: string
  spotRestBaseUrl: string
  perpRestBaseUrl: string
  spotWsBaseUrl: string
  perpWsBaseUrl: string
  symbols: string[]
  timeframes: MarketTimeframe[]
  historicalLookbackMinutes: number
  restBatchSize: number
  streamPathTemplate: string
  wsReconnectDelayMs: number
}

@Injectable()
export class MarketDataIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataIngestionService.name)
  private unsubscribe?: () => Promise<void> | void
  private subscribedSymbols: string[] = []
  private refreshInProgress = false

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(MarketDataService)
    private readonly marketDataService: MarketDataService,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    @Inject(MarketDataStreamService)
    private readonly streamService: MarketDataStreamService,
  ) {}

  async onModuleInit() {
    const baseConfig = this.getConfig()
    const config = await this.mergeDynamicSymbols(baseConfig)
    this.logger.log(
      `marketData endpoints spotRest=${config.spotRestBaseUrl} spotWs=${config.spotWsBaseUrl} perpRest=${config.perpRestBaseUrl} perpWs=${config.perpWsBaseUrl}`,
    )

    try {
      await this.bootstrapSymbols(config)
    } catch (error) {
      this.logger.error(`交易对信息同步失败: ${(error as Error).message}，将在后台重试`, (error as Error).stack)
    }

    try {
      await this.syncHistoricalBars(config)
    } catch (error) {
      this.logger.error(`历史 K 线同步失败: ${(error as Error).message}，将在后台重试`, (error as Error).stack)
    }

    try {
      await this.replaceRealtimeSubscription(config)
    } catch (error) {
      this.logger.error(`实时行情订阅失败: ${(error as Error).message}，将在后台重试`, (error as Error).stack)
    }

    this.logger.log(`行情模块初始化完成，订阅 ${config.symbols.join(', ')} (${config.timeframes.join(', ')})`)
  }

  async onModuleDestroy() {
    if (this.unsubscribe) {
      await this.unsubscribe()
      this.unsubscribe = undefined
    }
    await this.provider.disconnect()
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleGapFill() {
    const config = await this.mergeDynamicSymbols(this.getConfig())
    const startedAt = Date.now()
    try {
      await this.syncHistoricalBars(config)
      this.logger.log(`metric=market_gapfill_duration_ms value=${Date.now() - startedAt}`)
    } catch (error) {
      this.logger.warn(`metric=market_gapfill_failed_total value=1 reason=${(error as Error).message}`)
      throw error
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDynamicSymbolRefresh() {
    if (this.refreshInProgress) return
    this.refreshInProgress = true

    try {
      const config = await this.mergeDynamicSymbols(this.getConfig())
      const nextSymbols = config.symbols
      const currentSymbols = this.subscribedSymbols
      const hasChanged = nextSymbols.length !== currentSymbols.length
        || nextSymbols.some(symbol => !currentSymbols.includes(symbol))

      if (!hasChanged) return

      const addedSymbols = nextSymbols.filter(symbol => !currentSymbols.includes(symbol))
      if (addedSymbols.length > 0) {
        const addedConfig = { ...config, symbols: addedSymbols }
        await this.bootstrapSymbols(addedConfig)
        await this.syncHistoricalBars(addedConfig)
      }

      await this.replaceRealtimeSubscription(config)
      this.logger.log(`动态行情订阅已更新: ${config.symbols.join(', ')}`)
    } catch (error) {
      this.logger.error(`动态行情订阅刷新失败: ${(error as Error).message}`, (error as Error).stack)
    } finally {
      this.refreshInProgress = false
    }
  }

  async ensureSymbolsSubscribed(symbols: string[]): Promise<void> {
    const normalizedRequested = this.normalizeIngestionSymbols(symbols)
    if (normalizedRequested.length === 0) return

    const config = await this.mergeDynamicSymbols(this.getConfig())
    const nextSymbols = this.normalizeIngestionSymbols([...config.symbols, ...normalizedRequested])
    const currentSymbols = this.subscribedSymbols
    const hasChanged = nextSymbols.length !== currentSymbols.length
      || nextSymbols.some(symbol => !currentSymbols.includes(symbol))

    if (!hasChanged) return

    const addedSymbols = nextSymbols.filter(symbol => !currentSymbols.includes(symbol))
    if (addedSymbols.length > 0) {
      const addedConfig = { ...config, symbols: addedSymbols }
      await this.bootstrapSymbols(addedConfig)
      await this.syncHistoricalBars(addedConfig)
    }

    await this.replaceRealtimeSubscription({ ...config, symbols: nextSymbols })
    this.logger.log(`按需补订阅完成: ${nextSymbols.join(', ')}`)
  }

  private getConfig(): MarketDataRuntimeConfig {
    const config = this.configService.get<MarketDataRuntimeConfig>('marketData')
    if (!config) {
      throw new Error('marketData 配置未加载')
    }
    return {
      ...config,
      symbols: this.normalizeIngestionSymbols(config.symbols),
    }
  }

  private async mergeDynamicSymbols(config: MarketDataRuntimeConfig): Promise<MarketDataRuntimeConfig> {
    const dynamicSymbols = await this.collectDynamicStrategySymbols()
    if (dynamicSymbols.length === 0) {
      return config
    }

    return {
      ...config,
      symbols: this.normalizeIngestionSymbols([...config.symbols, ...dynamicSymbols]),
    }
  }

  private async collectDynamicStrategySymbols(): Promise<string[]> {
    const symbolSet = new Set<string>()

    const [strategySubscriptions, llmSubscriptions] = await Promise.all([
      this.prisma.userStrategySubscription.findMany({
        where: { status: 'active' },
        select: {
          strategyInstance: {
            select: {
              strategyTemplate: {
                select: {
                  legs: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.userLlmStrategySubscription.findMany({
        where: { status: 'active' },
        select: {
          llmStrategyInstance: {
            select: {
              strategy: {
                select: {
                  allowedSymbols: true,
                },
              },
            },
          },
        },
      }),
    ])

    for (const item of strategySubscriptions) {
      const legs = item.strategyInstance?.strategyTemplate?.legs
      const legSymbols = this.extractStrategyLegSymbols(legs)
      for (const symbol of legSymbols) {
        symbolSet.add(symbol)
      }
    }

    for (const item of llmSubscriptions) {
      const allowedSymbols = item.llmStrategyInstance?.strategy?.allowedSymbols
      const values = this.extractStringArray(allowedSymbols)
      for (const symbol of values) {
        symbolSet.add(symbol)
      }
    }

    return [...symbolSet]
  }

  private extractStrategyLegSymbols(legs: unknown): string[] {
    if (!Array.isArray(legs)) return []

    const symbols: string[] = []
    for (const leg of legs) {
      if (!leg || typeof leg !== 'object') continue
      const symbol = (leg as { symbol?: unknown }).symbol
      if (typeof symbol !== 'string') continue
      const normalized = symbol.trim().toUpperCase()
      if (normalized) symbols.push(normalized)
    }
    return symbols
  }

  private extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    const normalized: string[] = []
    for (const entry of value) {
      if (typeof entry !== 'string') continue
      const symbol = entry.trim().toUpperCase()
      if (symbol) normalized.push(symbol)
    }
    return normalized
  }

  private normalizeIngestionSymbols(symbols: string[]): string[] {
    const normalizedSymbols: string[] = []
    const seen = new Set<string>()
    const providerName = this.provider.name?.toUpperCase() ?? ''

    const pushUnique = (symbol: string) => {
      const adaptedSymbol = providerName === 'HYPERLIQUID'
        ? this.normalizeHyperliquidSymbol(symbol)
        : symbol

      if (!seen.has(adaptedSymbol)) {
        seen.add(adaptedSymbol)
        normalizedSymbols.push(adaptedSymbol)
      }
    }

    for (const symbol of symbols) {
      const normalized = normalizeExactCode(symbol)
      if (!normalized) continue

      if (!normalized.includes(':')) {
        const spotSymbol = toSymbolCode(normalized, 'SPOT')
        const perpSymbol = toSymbolCode(normalized, 'PERP')
        pushUnique(spotSymbol)
        pushUnique(perpSymbol)
        this.logger.warn(`MARKET_DATA_SYMBOLS 使用无后缀 symbol，已自动展开: ${normalized} -> ${spotSymbol}, ${perpSymbol}`)
        continue
      }

      if (!normalized.endsWith(':SPOT') && !normalized.endsWith(':PERP')) {
        throw new Error(`MARKET_DATA_SYMBOLS 包含未知 market 后缀: ${symbol}`)
      }

      pushUnique(normalized)
    }

    if (normalizedSymbols.length === 0) {
      throw new Error('marketData.symbols 配置为空')
    }

    return normalizedSymbols
  }

  private normalizeHyperliquidSymbol(symbol: string): string {
    const normalized = normalizeExactCode(symbol)
    const [raw, market] = normalized.split(':')
    if (!raw) return normalized

    const adaptedRaw = raw.endsWith('USDT')
      ? `${raw.slice(0, -4)}USDC`
      : raw

    if (market === 'SPOT' || market === 'PERP') {
      return `${adaptedRaw}:${market}`
    }
    return adaptedRaw
  }

  private async bootstrapSymbols(config: MarketDataRuntimeConfig) {
    const symbols = await this.provider.fetchSymbols(config.symbols)
    const exchangeFallback = this.provider.name?.toUpperCase() || config.provider.toUpperCase()
    await this.marketDataService.upsertSymbolsFromProvider(symbols, exchangeFallback)
  }

  private async syncHistoricalBars(config: MarketDataRuntimeConfig) {
    let failedCount = 0
    const lookbackMs = config.historicalLookbackMinutes * 60 * 1000
    const now = Date.now()
    const start = new Date(now - lookbackMs)

    for (const symbol of config.symbols) {
      for (const timeframe of config.timeframes) {
        const frameMs = getMarketTimeframeMs(timeframe)
        // 粗略估算需要的批次数，避免意外死循环
        const maxIterations = Math.ceil(lookbackMs / (frameMs * config.restBatchSize)) + 2
        let cursor = new Date(start)

        for (let i = 0; i < maxIterations; i += 1) {
          try {
            const bars = await this.provider.fetchHistoricalBars({
              symbol,
              timeframe: timeframe as MarketTimeframe,
              start: cursor,
              limit: config.restBatchSize,
            })

            if (!bars.length) break

            for (const bar of bars) {
              await this.marketDataService.saveBarFromProvider(bar)
            }

            const lastBar = bars[bars.length - 1]
            const nextCursorMs = lastBar.timestamp + frameMs

            if (nextCursorMs <= cursor.getTime() || nextCursorMs >= now) {
              break
            }

            cursor = new Date(nextCursorMs)
          } catch (error) {
            const err = error as Error
            failedCount += 1
            this.logger.error(
              `同步 K 线失败: ${symbol} ${timeframe} - ${err.message}`,
              err.stack,
              MARKET_DATA_LOG_CONTEXT,
            )
            break
          }
        }
      }
    }
    if (failedCount > 0) {
      this.logger.warn(`metric=market_gapfill_failed_total value=${failedCount}`)
    }
  }

  private async replaceRealtimeSubscription(config: MarketDataRuntimeConfig) {
    if (this.unsubscribe) {
      await this.unsubscribe()
      this.unsubscribe = undefined
    }

    this.unsubscribe = await this.provider.subscribe({
      symbols: config.symbols,
      timeframes: config.timeframes,
      onTick: async (tick: MarketQuotePayload) => {
        try {
          await this.marketDataService.saveQuoteFromProvider(tick)
          // 广播实时 ticker 数据到 SSE 订阅者
          this.streamService.emitQuote(tick)
        } catch (error) {
          this.logger.error(
            `保存实时行情失败: ${(error as Error).message}`,
            (error as Error).stack,
            MARKET_DATA_LOG_CONTEXT,
          )
        }
      },
      onKline: async (bar: MarketBarPayload) => {
        try {
          await this.marketDataService.saveBarFromProvider(bar)
        } catch (error) {
          this.logger.error(
            `保存实时 K 线失败: ${(error as Error).message}`,
            (error as Error).stack,
            MARKET_DATA_LOG_CONTEXT,
          )
        }
      },
    })
    this.subscribedSymbols = [...config.symbols]
  }
}
