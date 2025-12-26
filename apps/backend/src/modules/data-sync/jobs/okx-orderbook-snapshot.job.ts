/* eslint-disable perfectionist/sort-imports */

import type { Logger as WinstonLogger } from 'winston'
import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import type { OrderbookPairConfig } from '@prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// Nest 注入需要运行时引用 Service，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
// Nest 注入需要值导入
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
import type Redis from 'ioredis'

type OkxDepthLevel = [string, string, string?, string?, string?]

interface OkxDepthEntry {
  asks: OkxDepthLevel[]
  bids: OkxDepthLevel[]
  ts: string
  seqId?: string
}

interface OkxDepthResponse {
  code: string
  msg: string
  data?: OkxDepthEntry[]
}

interface OkxOrderbookCursor {
  /** 下次从 configs 的哪个索引开始处理（轮询） */
  nextIndex: number
}

interface TargetConfig {
  cfg: OrderbookPairConfig
  instId: string
  venueId: string
  marketKey: string
}

@Injectable()
export class OkxOrderBookSnapshotJob implements DataPullJob {
  readonly key = 'okx-orderbook-snapshot'

  private readonly logger = new Logger(OkxOrderBookSnapshotJob.name)
  private readonly managedVenueIds = ['okx-spot', 'okx-perp', 'okx-future']

  constructor(
    private readonly configService: ConfigService,
    private readonly orderbookPairConfigService: OrderbookPairConfigService,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  async run(currentCursor: string | null): Promise<JobRunResult> {
    const client = this.redisService.getClient()

    if (!this.isEnabled()) {
      this.logger.log('OKX orderbook snapshot job disabled (ORDERBOOK_OKX_SNAPSHOT_ENABLED=false)')
      return {
        fetchedCount: 0,
        newCursor: currentCursor,
        meta: { reason: 'disabled' },
      }
    }

    const configs = await this.orderbookPairConfigService.findEnabledConfigs()
    const targets: TargetConfig[] = []
    const enabledByVenue = new Map<string, Set<string>>()

    for (const cfg of configs) {
      if (cfg.venue.toUpperCase() !== 'OKX' || cfg.venueType !== 'CEX') continue

      const venueId = this.buildVenueIdFromConfig(cfg)
      const marketKey = this.buildMarketKeyFromConfig(cfg)

      const instId = this.resolveOkxInstId(cfg)
      if (!instId) {
        this.logger.warn(
          `Skip OKX orderbook config due to missing instId mapping: pairId=${cfg.pairId} instrument=${cfg.instrumentType}`,
        )
        continue
      }

      targets.push({ cfg, instId, venueId, marketKey })
      this.markEnabledMarketKey(enabledByVenue, venueId, marketKey)
    }

    if (!targets.length) {
      this.logger.warn('No enabled OKX orderbook configs found, skip OkxOrderBookSnapshotJob')
      await this.cleanupDisabledSnapshots(client, enabledByVenue)
      return {
        fetchedCount: 0,
        newCursor: currentCursor,
        meta: { reason: 'no_orderbook_configs' },
      }
    }

    const cursor = this.parseCursor(currentCursor)
    const total = targets.length
    const startIndex = cursor.nextIndex >= 0 && cursor.nextIndex < total ? cursor.nextIndex : 0
    const batchSize = this.getBatchSize()

    const batch: TargetConfig[] = []
    for (let i = 0; i < batchSize && i < total; i += 1) {
      const idx = (startIndex + i) % total
      if (idx === startIndex && i > 0) break
      batch.push(targets[idx])
    }

    const nextIndex = total > 0 ? (startIndex + batch.length) % total : 0

    const restBaseUrl = this.getRestBaseUrl()
    const restTimeoutMs = this.getRestTimeoutMs()

    const fetchedBooks: VenueOrderBook[] = []
    const errors: string[] = []

    for (const target of batch) {
      const depthLevels = target.cfg.depthLevels ?? 100
      try {
        const depth = await this.fetchDepth(restBaseUrl, target.instId, restTimeoutMs, depthLevels)
        const book = this.toVenueOrderBook(target, depth, depthLevels)
        fetchedBooks.push(book)
        const redisKey = this.buildRedisKey(target.venueId, book.marketKey)
        await client.set(redisKey, JSON.stringify(book))
      } catch (error) {
        const msg =
          error instanceof Error ? `${target.instId}: ${error.message}` : `${target.instId}: ${String(error)}`
        errors.push(msg)
        this.logger.error(`Failed to fetch/write OKX depth for ${target.instId}: ${msg}`)
      }
    }

    if (errors.length) {
      this.winstonLogger.warn('okx_orderbook_snapshot_errors', { errors })
    }

    await this.cleanupDisabledSnapshots(client, enabledByVenue)

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

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('ORDERBOOK_OKX_SNAPSHOT_ENABLED')
    if (typeof raw === 'string') return raw.toLowerCase() === 'true'
    return true
  }

  private getBatchSize(): number {
    const raw = this.configService.get<number>('ORDERBOOK_OKX_SNAPSHOT_BATCH_SIZE')
    const size = typeof raw === 'number' && Number.isFinite(raw) ? raw : 10
    return Math.max(1, Math.floor(size))
  }

  private getRestBaseUrl(): string {
    return this.configService.get<string>('ORDERBOOK_OKX_REST_BASE_URL') ?? 'https://www.okx.com'
  }

  private getRestTimeoutMs(): number {
    const raw = this.configService.get<number>('ORDERBOOK_OKX_REST_TIMEOUT_MS')
    const timeout = typeof raw === 'number' && Number.isFinite(raw) ? raw : 10_000
    return Math.max(1_000, Math.floor(timeout))
  }

  private async fetchDepth(
    baseUrl: string,
    instId: string,
    timeoutMs: number,
    depthLevels: number,
  ): Promise<OkxDepthEntry> {
    const url = new URL('/api/v5/market/books', baseUrl)
    const sz = Math.min(Math.max(depthLevels, 1), 400)
    url.searchParams.set('instId', instId)
    url.searchParams.set('sz', String(sz))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

    try {
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)
      }

      const json = (await res.json()) as OkxDepthResponse
      if (json.code !== '0') {
        throw new TypeError(`OKX API error code=${json.code} msg=${json.msg ?? 'unknown'}`)
      }

      const entry = json.data?.[0]
      if (!entry || !Array.isArray(entry.asks) || !Array.isArray(entry.bids)) {
        throw new TypeError('Invalid OKX depth response format')
      }

      return entry
    } finally {
      clearTimeout(timeout)
    }
  }

  private toVenueOrderBook(target: TargetConfig, entry: OkxDepthEntry, depthLevels: number): VenueOrderBook {
    const bids = this.normalizeLevels(entry.bids, 'bids', depthLevels)
    const asks = this.normalizeLevels(entry.asks, 'asks', depthLevels)

    const exchangeTs = Number(entry.ts)
    const version = Number(entry.seqId) || Date.now()

    return {
      venueId: target.venueId,
      marketKey: target.marketKey,
      bids,
      asks,
      exchangeTs: Number.isFinite(exchangeTs) ? exchangeTs : undefined,
      receivedTs: Date.now(),
      version,
    }
  }

  private normalizeLevels(
    levels: OkxDepthLevel[],
    side: 'bids' | 'asks',
    depthLevels: number,
  ): { price: number; size: number }[] {
    const parsed: { price: number; size: number }[] = []
    for (const [priceStr, sizeStr] of levels) {
      const price = Number(priceStr)
      const size = Number(sizeStr)
      if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) continue
      parsed.push({ price, size })
    }

    if (side === 'bids') parsed.sort((a, b) => b.price - a.price)
    else parsed.sort((a, b) => a.price - b.price)

    return parsed.slice(0, Math.max(1, depthLevels))
  }

  private buildMarketKeyFromConfig(cfg: Pick<OrderbookPairConfig, 'baseAsset' | 'quoteAsset' | 'instrumentType'>): string {
    return toMarketKey(this.toMarketIdFromConfig(cfg))
  }

  private buildVenueIdFromConfig(cfg: Pick<OrderbookPairConfig, 'instrumentType'>): string {
    switch (cfg.instrumentType) {
      case 'SPOT':
        return 'okx-spot'
      case 'PERPETUAL':
        return 'okx-perp'
      default:
        return 'okx-future'
    }
  }

  private toMarketIdFromConfig(cfg: Pick<OrderbookPairConfig, 'baseAsset' | 'quoteAsset' | 'instrumentType'>): MarketId {
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

  private resolveOkxInstId(cfg: OrderbookPairConfig): string | null {
    const metadata = this.normalizeMetadata(cfg.metadata)
    const metaInstId = this.pickMetadataString(metadata, ['okxInstId', 'instId', 'symbol'])
    if (metaInstId) return metaInstId.toUpperCase()

    const symbol = cfg.symbol.toUpperCase()
    if (symbol.includes('-')) return symbol

    const base = cfg.baseAsset.toUpperCase()
    const quote = cfg.quoteAsset.toUpperCase()

    if (cfg.instrumentType === 'SPOT') {
      return `${base}-${quote}`
    }

    if (cfg.instrumentType === 'PERPETUAL') {
      return `${base}-${quote}-SWAP`
    }

    if (cfg.instrumentType === 'FUTURE') {
      const metaContract = this.pickMetadataString(metadata, ['okxContract'])
      if (metaContract) return metaContract.toUpperCase()
    }

    return null
  }

  private normalizeMetadata(metadata: OrderbookPairConfig['metadata']): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object') return null
    if (Array.isArray(metadata)) return null
    return metadata as Record<string, unknown>
  }

  private pickMetadataString(
    metadata: Record<string, unknown> | null,
    keys: string[],
  ): string | null {
    if (!metadata) return null
    for (const key of keys) {
      const value = metadata[key]
      if (typeof value === 'string' && value.trim().length) {
        return value.trim()
      }
    }
    return null
  }

  private markEnabledMarketKey(map: Map<string, Set<string>>, venueId: string, marketKey: string): void {
    let set = map.get(venueId)
    if (!set) {
      set = new Set()
      map.set(venueId, set)
    }
    set.add(marketKey)
  }

  private buildRedisKey(venueId: string, marketKey: string): string {
    return `orderbook:${venueId}:${marketKey}`
  }

  private async cleanupDisabledSnapshots(
    client: Redis,
    enabledByVenue: Map<string, Set<string>>,
  ): Promise<void> {
    for (const venueId of this.managedVenueIds) {
      const keep = enabledByVenue.get(venueId) ?? new Set<string>()
      const prefix = `orderbook:${venueId}:`
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        for (const key of keys) {
          const marketKey = key.slice(prefix.length)
          if (!keep.has(marketKey)) {
            await client.del(key)
            this.logger.log(`Deleted stale OKX snapshot key=${key}`)
          }
        }
      } while (cursor !== '0')
    }
  }

  private parseCursor(currentCursor: string | null): OkxOrderbookCursor {
    if (!currentCursor) return { nextIndex: 0 }
    try {
      const parsed = JSON.parse(currentCursor) as Partial<OkxOrderbookCursor>
      const idx =
        typeof parsed.nextIndex === 'number' && Number.isFinite(parsed.nextIndex)
          ? Math.max(0, Math.floor(parsed.nextIndex))
          : 0
      return { nextIndex: idx }
    } catch {
      this.logger.warn(`Failed to parse cursor for OkxOrderBookSnapshotJob: ${currentCursor}`)
      return { nextIndex: 0 }
    }
  }
}
