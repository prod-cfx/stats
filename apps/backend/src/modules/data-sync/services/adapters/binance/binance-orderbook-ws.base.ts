/* eslint-disable perfectionist/sort-imports */

import type { MarketId, VenueOrderBook } from '@ai/shared'
import { ErrorCode, toMarketKey } from '@ai/shared'
import type { OrderbookPairConfig } from '@/prisma/prisma.types'
import WebSocket from 'ws'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
import type { Redis } from 'ioredis'
import type { OrderbookAdapterKey, OrderbookWsAdapter } from '../../orderbook-ws-adapter'
import { RedisService } from '@/common/services/redis.service'
import { TokenBucketRateLimiter } from '@/common/utils/token-bucket-rate-limiter'

type BinanceDepthLevel = [string, string]

interface BinanceDepthSnapshotResponse {
  lastUpdateId: number
  bids: BinanceDepthLevel[]
  asks: BinanceDepthLevel[]
}

interface BinanceDepthUpdateEvent {
  e: 'depthUpdate'
  E: number
  s: string
  U: number
  u: number
  b: BinanceDepthLevel[]
  a: BinanceDepthLevel[]
}

type BinanceCombinedStreamMessage =
  | { stream: string; data: BinanceDepthUpdateEvent }
  | BinanceDepthUpdateEvent
  | { result: null; id: number }
  | { error: { code: number; msg: string }; id: number }

interface SnapshotRetryState {
  failCount: number
  nextRetryAt: number
}

interface BookState {
  cfg: OrderbookPairConfig
  marketKey: string
  bids: Map<string, number>
  asks: Map<string, number>
  lastUpdateId: number
  buffer: BinanceDepthUpdateEvent[]
  isReady: boolean
  isStale: boolean
  lastPublishTs: number
}

/**
 * 币安 REST API 全局频率限制器
 * 所有币安适配器（spot/perp/future）共享此限制器
 * 速率：每分钟 2000 次（留 20% 余量，币安限制为 2400/min）
 * 桶容量：100（允许短时突发，覆盖冷启动场景）
 */
const binanceRestApiRateLimiter = new TokenBucketRateLimiter(
  100, // maxTokens: 允许 100 次突发请求（应对冷启动）
  33.33, // refillRate: 每秒补充 33.33 个令牌（约 2000/min）
)

/**
 * 指数退避失败次数上限
 * 防止 2^n 计算溢出（2^10 = 1024，已足够大）
 * 当 retryBaseMs=60000 时，2^9 * 60000 = 30720000ms (约 8.5 小时)
 * 实际退避时间受 retryMaxMs 限制（默认 10 分钟）
 */
const MAX_FAIL_COUNT_FOR_BACKOFF = 10

/**
 * Binance 订单薄 WS 同步通用基类：
 * - 连接池（按订阅上限分片）
 * - 心跳 + 超时重连
 * - snapshot + diff 合流（断档自动 resync）
 * - 写入 Redis（VenueOrderBook）
 */
@Injectable()
export abstract class BinanceOrderbookWsAdapterBase implements OrderbookWsAdapter {
  abstract readonly key: OrderbookAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract getWsBaseUrl(): string
  protected abstract getRestBaseUrl(): string
  protected abstract getRestDepthPath(): string
  protected abstract getMaxStreamsPerConnection(): number

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: BinanceWsConnection[] = []
  private readonly states = new Map<string, BookState>() // symbol -> state
  // 降噪：记录每个 symbol 最近一次深度断档告警时间，避免日志刷屏
  private readonly lastGapWarnAt = new Map<string, number>()
  // 失败重试状态：用于 snapshot 初始化的指数退避
  private readonly retryStates = new Map<string, SnapshotRetryState>()
  // 深度断档重同步防抖：避免短时间内反复触发 REST resync
  private readonly lastResyncAt = new Map<string, number>()
  private redis: Redis | null = null

  constructor(
    @Inject(ConfigService)
    protected readonly configService: ConfigService,
    @Inject(RedisService)
    protected readonly redisService: RedisService,
  ) {}

  async ensureConnected(): Promise<void> {
    await this.ensureConnections(1)
  }

  async syncTargetConfigs(configs: OrderbookPairConfig[]): Promise<void> {
    const targets = configs
      .filter(
        cfg =>
          cfg.venue.toUpperCase() === 'BINANCE' &&
          cfg.venueType === 'CEX' &&
          cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => a.priority - b.priority)

    const targetSymbols = new Map<string, OrderbookPairConfig>()
    for (const cfg of targets) {
      targetSymbols.set(cfg.symbol.toUpperCase(), cfg)
    }

    // 移除的 symbol：删除 state（订阅层会在 reconcile 时做 UNSUBSCRIBE）
    for (const symbol of [...this.states.keys()]) {
      if (!targetSymbols.has(symbol)) {
        const state = this.states.get(symbol)
        this.states.delete(symbol)
        this.retryStates.delete(symbol)
        this.lastResyncAt.delete(symbol)
        this.lastGapWarnAt.delete(symbol)
        await this.deleteRedisSnapshot(symbol, state)
      }
    }

    // 新增或更新
    for (const [symbol, cfg] of targetSymbols.entries()) {
      const state = this.states.get(symbol)
      if (!state) {
        const created: BookState = {
          cfg,
          marketKey: toMarketKey(this.toMarketIdFromConfig(cfg)),
          bids: new Map(),
          asks: new Map(),
          lastUpdateId: 0,
          buffer: [],
          isReady: false,
          isStale: false,
          lastPublishTs: 0,
        }
        this.states.set(symbol, created)
      } else {
        state.cfg = cfg
      }
    }

    // 1) 先同步订阅（确保 diff 可缓冲）
    await this.reconcileSubscriptions([...targetSymbols.keys()])

    // 2) 再初始化 snapshot
    const maxInitPerTick = this.configService.get<number>('ORDERBOOK_WS_MAX_INIT_PER_TICK') ?? 10
    const now = Date.now()
    const initQueue: string[] = []
    for (const cfg of targets) {
      const symbol = cfg.symbol.toUpperCase()
      const state = this.states.get(symbol)
      if (!state || state.isReady) continue
      const retryState = this.retryStates.get(symbol)
      // 退避窗口内直接跳过，避免失败重试爆发
      if (retryState && now < retryState.nextRetryAt) {
        continue
      }
      initQueue.push(symbol)
    }

    // 冷启动分批初始化，防止一次性拉取大量 snapshot
    const initBatch = initQueue.slice(0, Math.max(1, maxInitPerTick))
    // 并发初始化，提升冷启动性能
    const initPromises = initBatch.map(symbol => {
      const state = this.states.get(symbol)
      return state ? this.initSnapshot(symbol, state) : Promise.resolve()
    })
    await Promise.allSettled(initPromises)
  }

  async shutdown(): Promise<void> {
    for (const conn of this.connections) {
      conn.shutdown()
    }
    this.connections.length = 0
    this.states.clear()
    this.retryStates.clear()
    this.lastResyncAt.clear()
    this.lastGapWarnAt.clear()
    this.redis = null
  }

  protected streamNameForSymbol(symbol: string): string {
    // 默认 100ms；后续可从 cfg.metadata 读取
    return `${symbol.toLowerCase()}@depth@100ms`
  }

  private async ensureConnections(count: number): Promise<void> {
    if (!this.redis) this.redis = this.redisService.getClient()

    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new BinanceWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        raw => this.onMessage(raw),
      )
      this.connections.push(conn)
    }

    while (this.connections.length > count) {
      const conn = this.connections.pop()
      if (conn) conn.shutdown()
    }

    await Promise.allSettled(this.connections.map(c => c.ensureConnected()))
  }

  private async reconcileSubscriptions(symbols: string[]): Promise<void> {
    const perConn = Math.max(50, Math.floor(this.getMaxStreamsPerConnection()))

    const streams = symbols.map(s => this.streamNameForSymbol(s)).sort((a, b) => a.localeCompare(b))

    const chunks: string[][] = []
    for (let i = 0; i < streams.length; i += perConn) {
      chunks.push(streams.slice(i, i + perConn))
    }

    await this.ensureConnections(Math.max(1, chunks.length))

    await Promise.allSettled(
      this.connections.map((conn, idx) => conn.syncDesiredStreams(new Set(chunks[idx] ?? []))),
    )
  }

  private async onMessage(raw: WebSocket.RawData): Promise<void> {
    let msg: BinanceCombinedStreamMessage
    try {
      msg = JSON.parse(raw.toString()) as BinanceCombinedStreamMessage
    } catch {
      return
    }

    if ('result' in (msg as any)) return
    if ('error' in (msg as any)) {
      const err = (msg as any).error
      this.logger.warn(`Binance WS API error: code=${err?.code} msg=${err?.msg}`)
      return
    }

    const evt = (msg as any).data ? (msg as any).data : msg
    if (!evt || evt.e !== 'depthUpdate' || typeof evt.s !== 'string') return

    const symbol = evt.s.toUpperCase()
    const state = this.states.get(symbol)
    if (!state) return

    if (!state.isReady) {
      state.buffer.push(evt)
      if (state.buffer.length > 1000) state.buffer.shift()
      return
    }

    await this.applyUpdate(symbol, state, evt)
  }

  private async initSnapshot(symbol: string, state: BookState): Promise<void> {
    const cfg = state.cfg
    const restBaseUrl = this.getRestBaseUrl()
    const timeoutMs = this.configService.get<number>('marketData.restTimeoutMs') ?? 10_000
    const limit = this.resolveEffectiveDepthLevels(cfg)
    const retryBaseMs =
      this.configService.get<number>('ORDERBOOK_WS_SNAPSHOT_RETRY_BASE_MS') ?? 60_000
    const retryMaxMs =
      this.configService.get<number>('ORDERBOOK_WS_SNAPSHOT_RETRY_MAX_MS') ?? 600_000

    try {
      const snapshot = await this.fetchSnapshot(restBaseUrl, symbol, timeoutMs, limit)
      state.bids = this.levelsToMap(snapshot.bids)
      state.asks = this.levelsToMap(snapshot.asks)
      state.lastUpdateId = snapshot.lastUpdateId
      state.isReady = true
      state.isStale = false
      this.retryStates.delete(symbol)

      if (state.buffer.length) {
        const buffered = state.buffer
        state.buffer = []
        for (const evt of buffered) {
          if (evt.u <= state.lastUpdateId) continue
          const expected = state.lastUpdateId + 1
          if (evt.U <= expected && expected <= evt.u) {
            await this.applyUpdate(symbol, state, evt)
          }
        }
      }

      await this.publish(symbol, state, Date.now())
    } catch (error) {
      state.isReady = false
      await this.deleteRedisSnapshot(symbol, state)
      const prev = this.retryStates.get(symbol)
      const failCount = (prev?.failCount ?? 0) + 1
      // 指数退避：1m, 2m, 4m... 上限 10m（可通过环境变量覆盖）
      // 限制 failCount 上限防止数值溢出
      const safeFailCount = Math.min(failCount, MAX_FAIL_COUNT_FOR_BACKOFF)
      const backoffMs = Math.min(retryBaseMs * 2 ** (safeFailCount - 1), retryMaxMs)
      const nextRetryAt = Date.now() + backoffMs
      this.retryStates.set(symbol, { failCount, nextRetryAt })
      // 失败后保持 state，等待下次 syncTargetConfigs 按退避重试
      this.logger.error(
        `Failed to init snapshot for ${symbol}, retry in ${backoffMs}ms (failCount=${failCount}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async applyUpdate(
    symbol: string,
    state: BookState,
    evt: BinanceDepthUpdateEvent,
  ): Promise<void> {
    if (evt.u <= state.lastUpdateId) return
    const expected = state.lastUpdateId + 1
    if (!(evt.U <= expected && expected <= evt.u)) {
      const now = Date.now()
      const intervalMs =
        this.configService.get<number>('ORDERBOOK_WS_GAP_WARN_INTERVAL_MS') ?? 10_000
      const resyncDebounceMs =
        this.configService.get<number>('ORDERBOOK_WS_RESYNC_DEBOUNCE_MS') ?? 30_000
      const lastResync = this.lastResyncAt.get(symbol) ?? 0
      // 断档 resync 防抖：短时间内只允许触发一次 REST 重同步
      if (now - lastResync < resyncDebounceMs) {
        // 防抖期间跳过 resync，但继续应用更新以保持数据流动性
        // 数据可能有小 gap，但比完全停滞好；下次 resync 会修正
        const lastWarn = this.lastGapWarnAt.get(symbol) ?? 0
        if (now - lastWarn >= intervalMs) {
          this.lastGapWarnAt.set(symbol, now)
          this.logger.warn(
            `Depth gap resync skipped for ${symbol}: debounce ${resyncDebounceMs}ms not elapsed (last=${state.lastUpdateId}, U=${evt.U}, u=${evt.u}), continuing with partial update`,
          )
        }
        // 不设置 isStale，继续应用更新（跳过 gap 继续）
        this.applyLevelsToMap(state.bids, evt.b)
        this.applyLevelsToMap(state.asks, evt.a)
        state.lastUpdateId = evt.u
        // 继续发布
        const publishIntervalMs =
          this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
        if (now - state.lastPublishTs >= publishIntervalMs) {
          state.lastPublishTs = now
          await this.publish(symbol, state, evt.E)
        }
        return
      }

      // 触发 resync 前记录断档信息
      const lastWarn = this.lastGapWarnAt.get(symbol) ?? 0
      if (now - lastWarn >= intervalMs) {
        this.lastGapWarnAt.set(symbol, now)
        this.logger.warn(
          `Depth sequence gap for ${symbol}: last=${state.lastUpdateId}, U=${evt.U}, u=${evt.u}, triggering resync`,
        )
      }

      // 断档后触发 resync，但增加防抖避免短时间内反复请求 REST
      this.lastResyncAt.set(symbol, now)
      state.isReady = false
      state.isStale = true
      state.buffer = [evt]
      await this.initSnapshot(symbol, state)
      return
    }

    this.applyLevelsToMap(state.bids, evt.b)
    this.applyLevelsToMap(state.asks, evt.a)
    state.lastUpdateId = evt.u

    const publishIntervalMs =
      this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()
    if (now - state.lastPublishTs >= publishIntervalMs) {
      state.lastPublishTs = now
      await this.publish(symbol, state, evt.E)
    }
  }

  private async publish(_symbol: string, state: BookState, exchangeTs: number): Promise<void> {
    if (!this.redis) return

    if (state.isStale) {
      this.logger.debug(
        `Skipping publish for ${_symbol}: orderbook marked as stale, waiting for resync`,
      )
      return
    }

    const depthLevels = this.resolveEffectiveDepthLevels(state.cfg)
    this.trimMap(state.bids, 'bids', depthLevels)
    this.trimMap(state.asks, 'asks', depthLevels)

    const bids = this.mapToSortedLevels(state.bids, 'bids', depthLevels)
    const asks = this.mapToSortedLevels(state.asks, 'asks', depthLevels)

    const book: VenueOrderBook = {
      venueId: this.venueId,
      marketKey: state.marketKey,
      bids,
      asks,
      exchangeTs,
      receivedTs: Date.now(),
      version: state.lastUpdateId,
    }

    const redisKey = this.buildRedisKey(book.venueId, book.marketKey)
    await this.redis.set(redisKey, JSON.stringify(book))
  }

  private buildRedisKey(venueId: string, marketKey: string): string {
    return `orderbook:${venueId}:${marketKey}`
  }

  private async deleteRedisSnapshot(symbol: string, state?: BookState): Promise<void> {
    if (!this.redis || !state) return
    const redisKey = this.buildRedisKey(this.venueId, state.marketKey)
    try {
      await this.redis.del(redisKey)
      this.logger.log(
        `Orderbook snapshot deleted due to config removal: symbol=${symbol}, key=${redisKey}`,
      )
    } catch (error) {
      this.logger.warn(
        `Failed to delete orderbook snapshot for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async fetchSnapshot(
    baseUrl: string,
    symbol: string,
    timeoutMs: number,
    limit: number,
  ): Promise<BinanceDepthSnapshotResponse> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        // 获取频率限制令牌（最多等待 10 秒）
        await binanceRestApiRateLimiter.acquire(10_000)

        const url = new URL(this.getRestDepthPath(), baseUrl)
        url.searchParams.set('symbol', symbol)
        url.searchParams.set('limit', String(limit > 0 ? limit : 100))

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

        try {
          const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            const error = new TypeError(
              `HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`,
            )

            // 429 Too Many Requests: 指数退避重试
            if (res.status === 429 && attempt < maxRetries) {
              const backoffMs = 2 ** (attempt - 1) * 1000 // 1s, 2s, 4s
              this.logger.warn(
                `Binance API rate limit (429) for ${symbol}, retry ${attempt}/${maxRetries} after ${backoffMs}ms`,
              )
              await this.sleep(backoffMs)
              lastError = error
              continue
            }

            throw error
          }
          return (await res.json()) as BinanceDepthSnapshotResponse
        } finally {
          clearTimeout(timeout)
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw lastError ?? error
        }
        lastError = error as Error
      }
    }

    throw lastError ?? new DomainException(
      'data_sync.binance_orderbook_ws.fetch_snapshot_failed',
      { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: 'fetchSnapshot failed after retries' } },
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private levelsToMap(levels: BinanceDepthLevel[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const [p, q] of levels) {
      const qty = Number(q)
      if (!Number.isFinite(qty) || qty <= 0) continue
      map.set(String(p), qty)
    }
    return map
  }

  private applyLevelsToMap(target: Map<string, number>, levels: BinanceDepthLevel[]): void {
    for (const [p, q] of levels) {
      const qty = Number(q)
      const priceKey = String(p)
      if (!Number.isFinite(qty) || qty <= 0) {
        target.delete(priceKey)
      } else {
        target.set(priceKey, qty)
      }
    }
  }

  private mapToSortedLevels(
    map: Map<string, number>,
    side: 'bids' | 'asks',
    depthLevels: number,
  ): { price: number; size: number }[] {
    const entries: { price: number; size: number }[] = []
    for (const [p, s] of map.entries()) {
      const price = Number(p)
      if (!Number.isFinite(price) || !Number.isFinite(s) || s <= 0) continue
      entries.push({ price, size: s })
    }

    if (side === 'bids') entries.sort((a, b) => b.price - a.price)
    else entries.sort((a, b) => a.price - b.price)

    return entries.slice(0, Math.max(1, depthLevels))
  }

  private trimMap(map: Map<string, number>, side: 'bids' | 'asks', depthLevels: number): void {
    const keepN = Math.max(1, depthLevels)
    if (map.size <= keepN * 3) return

    const items: { key: string; price: number }[] = []
    for (const key of map.keys()) {
      const price = Number(key)
      if (!Number.isFinite(price)) continue
      items.push({ key, price })
    }
    if (!items.length) return

    if (side === 'bids') items.sort((a, b) => b.price - a.price)
    else items.sort((a, b) => a.price - b.price)

    const keep = new Set(items.slice(0, keepN).map(i => i.key))
    for (const key of map.keys()) {
      if (!keep.has(key)) map.delete(key)
    }
  }

  private resolveEffectiveDepthLevels(cfg: OrderbookPairConfig): number {
    const configured = cfg.depthLevels ?? 100
    // ETH/BTC 永续在 500 档下价格覆盖通常偏窄，默认提升到 1000 档。
    if (
      cfg.instrumentType === 'PERPETUAL'
      && (cfg.baseAsset === 'BTC' || cfg.baseAsset === 'ETH')
      && configured < 1000
    ) {
      return 1000
    }
    return configured
  }

  private toMarketIdFromConfig(
    cfg: Pick<OrderbookPairConfig, 'baseAsset' | 'quoteAsset' | 'instrumentType'>,
  ): MarketId {
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
}

class BinanceWsConnection {
  private ws: WebSocket | null = null
  private open = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTs = 0
  private requestId = 1

  private desired = new Set<string>()
  private active = new Set<string>()

  constructor(
    private readonly index: number,
    private readonly configService: ConfigService,
    private readonly baseLogger: Logger,
    private readonly getWsBaseUrl: () => string,
    private readonly onMessage: (raw: WebSocket.RawData) => void,
  ) {}

  async ensureConnected(): Promise<void> {
    if (this.open && this.ws) return
    await this.connect()
  }

  async syncDesiredStreams(desired: Set<string>): Promise<void> {
    this.desired = desired
    if (!this.open || !this.ws) return

    const toSub: string[] = []
    const toUnsub: string[] = []

    for (const s of this.desired) {
      if (!this.active.has(s)) toSub.push(s)
    }
    for (const s of this.active) {
      if (!this.desired.has(s)) toUnsub.push(s)
    }

    if (toUnsub.length) {
      this.send({ method: 'UNSUBSCRIBE', params: toUnsub, id: this.requestId++ })
      for (const s of toUnsub) this.active.delete(s)
    }
    if (toSub.length) {
      this.send({ method: 'SUBSCRIBE', params: toSub, id: this.requestId++ })
      for (const s of toSub) this.active.add(s)
    }
  }

  shutdown(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    this.open = false
    this.active.clear()
    this.desired.clear()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }
  }

  private async connect(): Promise<void> {
    if (this.ws && (this.open || this.ws.readyState === WebSocket.CONNECTING)) return

    const wsBaseUrl = this.getWsBaseUrl()
    const url = new URL('/ws', wsBaseUrl).toString()
    const logger = this.baseLogger

    logger.log(`Connecting Binance WS#${this.index}: ${url}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`Binance WS#${this.index} connected`)
      this.startHeartbeat()
      void this.resyncOnOpen()
    })

    this.ws.on('message', data => {
      this.onMessage(data)
    })

    this.ws.on('pong', () => {
      this.lastPongTs = Date.now()
    })

    this.ws.on('close', (code, reason) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.warn(`Binance WS#${this.index} closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', err => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(
        `Binance WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`,
      )
      this.scheduleReconnect()
    })
  }

  private async resyncOnOpen(): Promise<void> {
    if (!this.open || !this.ws) return
    this.active.clear()
    const streams = [...this.desired]
    if (!streams.length) return
    this.send({ method: 'SUBSCRIBE', params: streams, id: this.requestId++ })
    for (const s of streams) this.active.add(s)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delayMs = this.configService.get<number>('marketData.wsReconnectDelayMs') ?? 5_000
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = null
        void this.connect()
      },
      Math.max(1_000, delayMs),
    )
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    const intervalMs =
      this.configService.get<number>('ORDERBOOK_WS_HEARTBEAT_INTERVAL_MS') ?? 15_000
    const timeoutMs = this.configService.get<number>('ORDERBOOK_WS_HEARTBEAT_TIMEOUT_MS') ?? 45_000

    this.heartbeatTimer = setInterval(
      () => {
        if (!this.ws) return
        const now = Date.now()
        if (now - this.lastPongTs > timeoutMs) {
          try {
            this.baseLogger.warn(`Binance WS#${this.index} heartbeat timeout, terminating`)
            this.ws.terminate()
          } catch {}
          return
        }
        try {
          this.ws.ping()
        } catch {}
      },
      Math.max(5_000, intervalMs),
    )
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private send(payload: unknown): void {
    if (!this.ws || !this.open) return
    try {
      this.ws.send(JSON.stringify(payload))
    } catch {}
  }
}
