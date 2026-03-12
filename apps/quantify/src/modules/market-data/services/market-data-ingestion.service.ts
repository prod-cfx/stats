import type { MarketBarPayload, MarketQuotePayload, MarketTimeframe } from '@ai/shared'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { MarketDataProvider } from '../interfaces/market-data-provider.interface'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { MARKET_DATA_LOG_CONTEXT, MARKET_DATA_PROVIDER } from '../constants/market-data.constants'
import { MarketDataStreamService } from './market-data-stream.service'
import { MarketDataService } from './market-data.service'

interface MarketDataRuntimeConfig {
  provider: string
  restBaseUrl: string
  wsBaseUrl: string
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

    try {
      await this.bootstrapSymbols(config)
    } catch (error) {
      this.logger.error(`浜ゆ槗瀵逛俊鎭悓姝ュけ璐? ${(error as Error).message}锛屽皢鍦ㄥ悗鍙伴噸璇昤, (error as Error).stack)
    }

    try {
      await this.syncHistoricalBars(config)
    } catch (error) {
      this.logger.error(`鍘嗗彶 K 绾垮悓姝ュけ璐? ${(error as Error).message}锛屽皢鍦ㄥ悗鍙伴噸璇昤, (error as Error).stack)
    }

    try {
      await this.startRealtimeSubscription(config)
    } catch (error) {
      this.logger.error(`瀹炴椂琛屾儏璁㈤槄澶辫触: ${(error as Error).message}锛屽皢鍦ㄥ悗鍙伴噸璇昤, (error as Error).stack)
    }

    this.logger.log(`琛屾儏妯″潡鍒濆鍖栧畬鎴愶紝璁㈤槄 ${config.symbols.join(', ')} (${config.timeframes.join(', ')})`)
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
    await this.syncHistoricalBars(config)
  }

  private getConfig(): MarketDataRuntimeConfig {
    const config = this.configService.get<MarketDataRuntimeConfig>('marketData')
    if (!config) {
      throw new Error('marketData 閰嶇疆鏈姞杞?)
    }
    return config
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
        // 鐞嗚涓婁笉浼氳蛋鍒拌繖閲岋紝鍏滃簳杩斿洖 1 鍒嗛挓
        return 60_000
    }
  }

  private async bootstrapSymbols(config: MarketDataRuntimeConfig) {
    const symbols = await this.provider.fetchSymbols(config.symbols)
    await this.marketDataService.upsertSymbolsFromProvider(symbols, 'BINANCE')
  }

  private async syncHistoricalBars(config: MarketDataRuntimeConfig) {
    const lookbackMs = config.historicalLookbackMinutes * 60 * 1000
    const now = Date.now()
    const start = new Date(now - lookbackMs)

    for (const symbol of config.symbols) {
      for (const timeframe of config.timeframes) {
        const frameMs = this.getTimeframeMs(timeframe as MarketTimeframe)
        // 绮楃暐浼扮畻闇€瑕佺殑鎵规鏁帮紝閬垮厤鎰忓姝诲惊鐜?
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
            this.logger.error(
              `鍚屾 K 绾垮け璐? ${symbol} ${timeframe} - ${err.message}`,
              err.stack,
              MARKET_DATA_LOG_CONTEXT,
            )
            break
          }
        }
      }
    }
  }

  private async startRealtimeSubscription(config: MarketDataRuntimeConfig) {
    this.unsubscribe = await this.provider.subscribe({
      symbols: config.symbols,
      timeframes: config.timeframes,
      onTick: async (tick: MarketQuotePayload) => {
        try {
          await this.marketDataService.saveQuoteFromProvider(tick)
          // 骞挎挱瀹炴椂 ticker 鏁版嵁鍒?SSE 璁㈤槄鑰?
          this.streamService.emitQuote(tick)
        } catch (error) {
          this.logger.error(
            `淇濆瓨瀹炴椂琛屾儏澶辫触: ${(error as Error).message}`,
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
            `淇濆瓨瀹炴椂 K 绾垮け璐? ${(error as Error).message}`,
            (error as Error).stack,
            MARKET_DATA_LOG_CONTEXT,
          )
        }
      },
    })
  }
}
