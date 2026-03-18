import type { MarketBarPayload, MarketQuotePayload, MarketTimeframe } from '@ai/shared'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { MarketDataProvider } from '../interfaces/market-data-provider.interface'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { MARKET_DATA_LOG_CONTEXT, MARKET_DATA_PROVIDER } from '../constants/market-data.constants'
import { normalizeExactCode, toSymbolCode } from '../utils/market-symbol-code.util'
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

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(MarketDataService)
    private readonly marketDataService: MarketDataService,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    @Inject(MarketDataStreamService)
    private readonly streamService: MarketDataStreamService,
  ) {}

  async onModuleInit() {
    const config = this.getConfig()
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
      await this.startRealtimeSubscription(config)
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
    const config = this.getConfig()
    const startedAt = Date.now()
    try {
      await this.syncHistoricalBars(config)
      this.logger.log(`metric=market_gapfill_duration_ms value=${Date.now() - startedAt}`)
    } catch (error) {
      this.logger.warn(`metric=market_gapfill_failed_total value=1 reason=${(error as Error).message}`)
      throw error
    }
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

  private normalizeIngestionSymbols(symbols: string[]): string[] {
    const normalizedSymbols: string[] = []
    const seen = new Set<string>()

    const pushUnique = (symbol: string) => {
      if (!seen.has(symbol)) {
        seen.add(symbol)
        normalizedSymbols.push(symbol)
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

  private getTimeframeMs(timeframe: MarketTimeframe): number {
    switch (timeframe) {
      case '1m':
        return 60_000
      case '5m':
        return 5 * 60_000
      case '15m':
        return 15 * 60_000
      case '1h':
        return 60 * 60_000
      case '4h':
        return 4 * 60 * 60_000
      case '1d':
        return 24 * 60 * 60_000
      default:
        // 理论上不会走到这里，兜底返回 1 分钟
        return 60_000
    }
  }

  private async bootstrapSymbols(config: MarketDataRuntimeConfig) {
    const symbols = await this.provider.fetchSymbols(config.symbols)
    await this.marketDataService.upsertSymbolsFromProvider(symbols, 'BINANCE')
  }

  private async syncHistoricalBars(config: MarketDataRuntimeConfig) {
    let failedCount = 0
    const lookbackMs = config.historicalLookbackMinutes * 60 * 1000
    const now = Date.now()
    const start = new Date(now - lookbackMs)

    for (const symbol of config.symbols) {
      for (const timeframe of config.timeframes) {
        const frameMs = this.getTimeframeMs(timeframe as MarketTimeframe)
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

  private async startRealtimeSubscription(config: MarketDataRuntimeConfig) {
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
  }
}
