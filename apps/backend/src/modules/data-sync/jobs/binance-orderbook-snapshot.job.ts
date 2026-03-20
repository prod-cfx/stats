/* eslint-disable perfectionist/sort-imports */

import type { Logger as WinstonLogger } from 'winston'
import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Inject, Injectable, Logger } from '@nestjs/common'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
import type Redis from 'ioredis'
import { TokenBucketRateLimiter } from '@/common/utils/token-bucket-rate-limiter'

type BinanceDepthLevel = [string, string]

interface BinanceDepthResponse {
  lastUpdateId: number
  E?: number
  T?: number
  bids: BinanceDepthLevel[]
  asks: BinanceDepthLevel[]
}

interface BinanceOrderbookCursor {
  /** 下次从 configs 的哪个索引开始处理（轮询） */
  nextIndex: number
}

/**
 * 币安 REST API 全局频率限制器
 * 所有币安适配器（spot/perp/future）和 Job 共享此限制器
 * 速率：每分钟 2000 次（留 20% 余量，币安限制为 2400/min）
 * 桶容量：100（允许短时突发，覆盖冷启动场景）
 */
export const binanceRestApiRateLimiter = new TokenBucketRateLimiter(
  100,    // maxTokens: 允许 100 次突发请求（应对冷启动）
  33.33,  // refillRate: 每秒补充 33.33 个令牌（约 2000/min）
)

@Injectable()
export class BinanceOrderBookSnapshotJob implements DataPullJob {
  readonly key = 'binance-orderbook-snapshot'

  private readonly logger = new Logger(BinanceOrderBookSnapshotJob.name)
  private readonly venueId = 'binance-spot' as const

  constructor(
    private readonly configService: ConfigService,
    private readonly orderbookPairConfigService: OrderbookPairConfigService,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const client = this.redisService.getClient()

    const restBaseUrl =
      this.configService.get<string>('marketData.restBaseUrl') ?? 'https://api.binance.com'
    const restTimeoutMs =
      this.configService.get<number>('marketData.restTimeoutMs') ?? 10_000

    // 统一来源：订单薄配置表（orderbook_pair_configs）
    const allConfigs = await this.orderbookPairConfigService.findEnabledConfigs()
    const configs = allConfigs.filter(
      cfg =>
        cfg.venue.toUpperCase() === 'BINANCE' &&
        cfg.venueType === 'CEX' &&
        cfg.instrumentType === 'SPOT',
    )

    if (!configs.length) {
      this.logger.warn('No enabled BINANCE SPOT orderbook configs found, skip BinanceOrderBookSnapshotJob')
      await this.cleanupDisabledSnapshots(client, new Set())
      return {
        fetchedCount: 0,
        newCursor: ctx.cursor,
        meta: { reason: 'no_orderbook_configs' },
      }
    }

    // 为避免在大量交易对场景下触发交易所限频，每次只处理一小批（轮询）
    const cursor = this.parseCursor(ctx.cursor)
    const total = configs.length
    const startIndex = cursor.nextIndex >= 0 && cursor.nextIndex < total ? cursor.nextIndex : 0
    const maxPerRun =
      this.configService.get<number>('MARKET_DATA_ORDERBOOK_SNAPSHOT_BATCH_SIZE') ?? 10
    const batchSize = Math.max(1, maxPerRun)

    const enabledMarketKeys = new Set(configs.map(cfg => this.buildMarketKeyFromConfig(cfg)))

    const batch: typeof configs = []
    for (let i = 0; i < batchSize && i < total; i += 1) {
      const idx = (startIndex + i) % total
      // 防止在 total < batchSize 且已经绕一圈时继续重复处理
      if (idx === startIndex && i > 0) break
      batch.push(configs[idx])
    }

    const nextIndex = (startIndex + batch.length) % total

    const fetchedBooks: VenueOrderBook[] = []
    const errors: string[] = []

    for (const cfg of batch) {
      const symbol = cfg.symbol.toUpperCase()
      const limit = cfg.depthLevels ?? 100

      try {
        const res = await this.fetchDepth(restBaseUrl, symbol, restTimeoutMs, limit)
        const book = this.toVenueOrderBook(cfg, res)
        fetchedBooks.push(book)

        const redisKey = this.buildRedisKey(book.venueId, book.marketKey)
        await client.set(redisKey, JSON.stringify(book))
      } catch (error) {
        const msg =
          error instanceof Error ? `${symbol}: ${error.message}` : `${symbol}: ${String(error)}`
        errors.push(msg)
        this.logger.error(`Failed to fetch/write depth for ${symbol}: ${msg}`)
      }
    }

    if (errors.length) {
      this.winstonLogger.warn('binance_orderbook_snapshot_errors', {
        errors,
      })
    }

    await this.cleanupDisabledSnapshots(client, enabledMarketKeys)

    return {
      fetchedCount: fetchedBooks.length,
      newCursor: JSON.stringify({ nextIndex }),
      meta: {
        configsTotal: total,
        configsProcessed: batch.length,
        startIndex,
        nextIndex,
        successCount: fetchedBooks.length,
        failedCount: errors.length,
      },
    }
  }

  private async fetchDepth(
    baseUrl: string,
    symbol: string,
    timeoutMs: number,
    limit: number,
  ): Promise<BinanceDepthResponse> {
    // 在 fetch 前获取限流器令牌，避免与 WS 适配器争抢 API 配额
    await binanceRestApiRateLimiter.acquire(10_000)

    const url = new URL('/api/v3/depth', baseUrl)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('limit', String(limit > 0 ? limit : 100))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)
      }

      const json = (await res.json()) as BinanceDepthResponse
      if (!Array.isArray(json.bids) || !Array.isArray(json.asks)) {
        throw new TypeError('Invalid depth response format')
      }

      return json
    } finally {
      clearTimeout(timeout)
    }
  }

  private toVenueOrderBook(
    cfg: {
      symbol: string
      baseAsset: string
      quoteAsset: string
      instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
      venue: string
    },
    depth: BinanceDepthResponse,
  ): VenueOrderBook {
    const market = this.toMarketIdFromConfig(cfg)
    const marketKey = toMarketKey(market)
    const receivedTs = Date.now()

    const bids = depth.bids
      .map(([price, qty]) => ({
        price: Number(price),
        size: Number(qty),
      }))
      // Binance bids 默认已按价格从高到低排序，这里再做一次排序以确保正确
      .filter(level => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0)
      .sort((a, b) => b.price - a.price)

    const asks = depth.asks
      .map(([price, qty]) => ({
        price: Number(price),
        size: Number(qty),
      }))
      // Binance asks 默认已按价格从低到高排序，这里再做一次排序以确保正确
      .filter(level => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0)
      .sort((a, b) => a.price - b.price)

    const exchangeTs = depth.E ?? depth.T

    const book: VenueOrderBook = {
      venueId: this.venueId,
      marketKey,
      bids,
      asks,
      exchangeTs: typeof exchangeTs === 'number' ? exchangeTs : undefined,
      receivedTs,
      // 这里暂时使用 lastUpdateId 作为 version，后续可以与 WS diff 流整合
      version: depth.lastUpdateId,
    }

    return book
  }

  private buildRedisKey(venueId: string, marketKey: string): string {
    return `orderbook:${venueId}:${marketKey}`
  }

  private toMarketIdFromConfig(cfg: {
    baseAsset: string
    quoteAsset: string
    instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  }): MarketId {
    const base = cfg.baseAsset.toUpperCase()
    const quote = cfg.quoteAsset.toUpperCase()

    const venueType: MarketId['venueType'] =
      cfg.instrumentType === 'SPOT'
        ? 'spot'
        : cfg.instrumentType === 'PERPETUAL'
          ? 'perp'
          : 'future'

    return { base, quote, venueType }
  }

  private buildMarketKeyFromConfig(cfg: {
    baseAsset: string
    quoteAsset: string
    instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  }): string {
    return toMarketKey(this.toMarketIdFromConfig(cfg))
  }

  private async cleanupDisabledSnapshots(
    client: Redis,
    enabledMarketKeys: Set<string>,
  ): Promise<void> {
    const prefix = `orderbook:${this.venueId}:`
    let cursor = '0'
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
      cursor = nextCursor
      for (const key of keys) {
        const marketKey = key.slice(prefix.length)
        if (!enabledMarketKeys.has(marketKey)) {
          await client.del(key)
          this.logger.log(`Deleted stale snapshot key=${key}`)
        }
      }
    } while (cursor !== '0')
  }

  private parseCursor(currentCursor: string | null): BinanceOrderbookCursor {
    if (!currentCursor) return { nextIndex: 0 }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<BinanceOrderbookCursor>
      const idx =
        typeof parsed.nextIndex === 'number' && Number.isFinite(parsed.nextIndex)
          ? Math.max(0, Math.floor(parsed.nextIndex))
          : 0
      return { nextIndex: idx }
    } catch {
      this.logger.warn(`Failed to parse cursor for BinanceOrderBookSnapshotJob: ${currentCursor}`)
      return { nextIndex: 0 }
    }
  }
}


