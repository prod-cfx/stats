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

type BitmaxDepthLevel = [string, string]

/**
 * Bitmax/AscendEX REST API 全局频率限制器
 * 所有 Bitmax 适配器（spot/perp/future）共享此限制器
 * 速率：每秒 10 次请求（AscendEX 限制较保守）
 * 桶容量：50（允许短时突发，覆盖冷启动场景）
 */
const bitmaxRestApiRateLimiter = new TokenBucketRateLimiter(
  50,   // maxTokens: 允许 50 次突发请求（应对冷启动）
  10,   // refillRate: 每秒补充 10 个令牌
)

interface BitmaxDepthData {
  ts: number
  seqnum: number
  bids: BitmaxDepthLevel[]
  asks: BitmaxDepthLevel[]
}

interface BitmaxDepthMessage {
  m: 'depth' | 'depth-snapshot' | 'ping' | 'pong' | 'sub' | 'unsub' | 'connected' | 'error'
  symbol?: string
  data?: BitmaxDepthData
  hp?: number
  code?: number
  reason?: string
  ch?: string
  id?: string
}

interface BitmaxRestResponse {
  code: number
  message?: string
  data?: {
    m: string
    symbol?: string
    data?: BitmaxDepthData
  }
}

interface BufferedEvent {
  data: BitmaxDepthData
}

interface BookState {
  cfg: OrderbookPairConfig
  marketKey: string
  bids: Map<string, number>
  asks: Map<string, number>
  lastSeqnum: number
  buffer: BufferedEvent[]
  isReady: boolean
  lastPublishTs: number
}

/**
 * Bitmax/AscendEX 订单薄 WS 同步通用基类：
 * - 连接池（按订阅上限分片）
 * - 心跳（服务器发 ping，客户端回 pong）
 * - snapshot + diff 合流
 * - 写入 Redis（VenueOrderBook）
 *
 * 注意：期货/永续 API 没有 REST snapshot 端点，使用纯 WS 模式
 */
@Injectable()
export abstract class BitmaxOrderbookWsAdapterBase implements OrderbookWsAdapter {
  abstract readonly key: OrderbookAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract getWsBaseUrl(): string
  protected abstract getRestBaseUrl(): string
  protected abstract getMaxStreamsPerConnection(): number
  /** 是否有 REST snapshot 端点（现货有，期货/永续没有） */
  protected abstract hasRestSnapshot(): boolean

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: BitmaxWsConnection[] = []
  private readonly states = new Map<string, BookState>() // symbol -> state
  // 降噪：记录每个 symbol 最近一次深度断档告警时间，避免日志刷屏
  private readonly lastGapWarnAt = new Map<string, number>()
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
      .filter(cfg =>
        cfg.venue.toUpperCase() === 'BITMAX' &&
        cfg.venueType === 'CEX' &&
        cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => a.priority - b.priority)

    const desiredSymbols = new Map<string, OrderbookPairConfig>()
    for (const cfg of targets) {
      const symbol = this.resolveSymbol(cfg)
      if (!symbol) {
        this.logger.warn(`Orderbook config missing Bitmax symbol mapping, skip: pairId=${cfg.pairId}`)
        continue
      }
      desiredSymbols.set(symbol, cfg)
    }

    // 移除不再需要的 symbol
    for (const symbol of [...this.states.keys()]) {
      if (!desiredSymbols.has(symbol)) {
        const state = this.states.get(symbol)
        this.states.delete(symbol)
        await this.deleteRedisSnapshot(symbol, state)
      }
    }

    const newSymbols: string[] = []

    for (const [symbol, cfg] of desiredSymbols.entries()) {
      const state = this.states.get(symbol)
      if (!state) {
        const created: BookState = {
          cfg,
          marketKey: toMarketKey(this.toMarketIdFromConfig(cfg)),
          bids: new Map(),
          asks: new Map(),
          lastSeqnum: 0,
          buffer: [],
          isReady: false,
          lastPublishTs: 0,
        }
        this.states.set(symbol, created)
        newSymbols.push(symbol)
      } else {
        state.cfg = cfg
      }
    }

    // 1) 同步订阅
    await this.reconcileSubscriptions([...desiredSymbols.keys()])

    // 2) 初始化 snapshot（仅现货使用 REST，期货/永续等待 WS 数据）
    for (const symbol of newSymbols) {
      const state = this.states.get(symbol)
      if (state && this.hasRestSnapshot()) {
        await this.initSnapshotFromRest(symbol, state)
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const conn of this.connections) {
      conn.shutdown()
    }
    this.connections.length = 0
    this.states.clear()
    this.redis = null
  }

  private async ensureConnections(count: number): Promise<void> {
    if (!this.redis) this.redis = this.redisService.getClient()

    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new BitmaxWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        (msg) => this.onMessage(msg),
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
    const perConn = Math.max(1, Math.floor(this.getMaxStreamsPerConnection()))
    const streams = [...new Set(symbols)].sort((a, b) => a.localeCompare(b))

    const chunks: string[][] = []
    for (let i = 0; i < streams.length; i += perConn) {
      chunks.push(streams.slice(i, i + perConn))
    }

    await this.ensureConnections(Math.max(1, chunks.length))

    await Promise.allSettled(
      this.connections.map((conn, idx) => conn.syncDesiredStreams(new Set(chunks[idx] ?? []))),
    )
  }

  private async onMessage(msg: BitmaxDepthMessage): Promise<void> {
    // depth-snapshot 或 depth 消息
    if (msg.m !== 'depth' && msg.m !== 'depth-snapshot') return
    if (!msg.symbol || !msg.data) return

    const symbol = msg.symbol.toUpperCase()
    const state = this.states.get(symbol)
    if (!state) return

    const data = msg.data

    // 期货/永续模式：首次收到数据时初始化
    if (!this.hasRestSnapshot() && !state.isReady) {
      // 使用首次数据作为 snapshot
      this.applySnapshotState(state, data)
      state.isReady = true
      await this.publish(symbol, state, data.ts)
      return
    }

    // 现货模式或已 ready：缓冲直到 snapshot 就绪
    if (!state.isReady) {
      state.buffer.push({ data })
      if (state.buffer.length > 1000) state.buffer.shift()
      return
    }

    await this.applyUpdate(symbol, state, data)
  }

  private async initSnapshotFromRest(symbol: string, state: BookState): Promise<void> {
    const restBaseUrl = this.getRestBaseUrl()
    const timeoutMs = this.configService.get<number>('marketData.restTimeoutMs') ?? 10_000

    try {
      const data = await this.fetchSnapshot(restBaseUrl, symbol, timeoutMs)
      this.applySnapshotState(state, data)
      state.isReady = true
      await this.publish(symbol, state, data.ts)

      // 处理缓冲的更新
      if (state.buffer.length) {
        const buffered = state.buffer
        state.buffer = []
        for (const evt of buffered) {
          if (evt.data.seqnum <= state.lastSeqnum) continue
          await this.applyUpdate(symbol, state, evt.data)
        }
      }
    } catch (error) {
      state.isReady = false
      this.states.delete(symbol)
      await this.deleteRedisSnapshot(symbol, state)
      this.logger.error(
        `Failed to init Bitmax snapshot for ${symbol}, will retry on next sync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private applySnapshotState(state: BookState, data: BitmaxDepthData): void {
    state.bids = this.levelsToMap(data.bids)
    state.asks = this.levelsToMap(data.asks)
    state.lastSeqnum = data.seqnum ?? 0
  }

  private async applyUpdate(symbol: string, state: BookState, data: BitmaxDepthData): Promise<void> {
    const seqnum = data.seqnum

    // seqnum 断档检测（Bitmax seqnum 不保证连续，只保证递增）
    if (seqnum <= state.lastSeqnum) return

    // 检测大断档，触发 resync（阈值可配置，默认 200）
    const gapThreshold = this.configService.get<number>('ORDERBOOK_WS_BITMAX_GAP_THRESHOLD') ?? 200
    const gap = seqnum - state.lastSeqnum
    if (gap > gapThreshold && state.lastSeqnum > 0) {
      // 降噪：限制告警频率
      const now = Date.now()
      const warnIntervalMs = this.configService.get<number>('ORDERBOOK_WS_GAP_WARN_INTERVAL_MS') ?? 10_000
      const lastWarn = this.lastGapWarnAt.get(symbol) ?? 0
      if (now - lastWarn >= warnIntervalMs) {
        this.lastGapWarnAt.set(symbol, now)
        this.logger.warn(
          `Large seqnum gap for ${symbol}: last=${state.lastSeqnum}, new=${seqnum}, gap=${gap}, resync`,
        )
      }
      state.isReady = false
      state.buffer = [{ data }]
      if (this.hasRestSnapshot()) {
        await this.initSnapshotFromRest(symbol, state)
      } else {
        // 期货/永续模式：使用当前数据重新初始化
        this.applySnapshotState(state, data)
        state.isReady = true
        await this.publish(symbol, state, data.ts)
      }
      return
    }

    // 应用增量更新
    this.applyLevelsToMap(state.bids, data.bids)
    this.applyLevelsToMap(state.asks, data.asks)
    state.lastSeqnum = seqnum

    const publishIntervalMs = this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()
    if (now - state.lastPublishTs >= publishIntervalMs) {
      state.lastPublishTs = now
      await this.publish(symbol, state, data.ts)
    }
  }

  private async publish(_symbol: string, state: BookState, exchangeTs?: number): Promise<void> {
    if (!this.redis) return

    const depthLevels = state.cfg.depthLevels ?? 100
    this.trimMap(state.bids, 'bids', depthLevels)
    this.trimMap(state.asks, 'asks', depthLevels)

    const bids = this.mapToSortedLevels(state.bids, 'bids', depthLevels)
    const asks = this.mapToSortedLevels(state.asks, 'asks', depthLevels)

    const book: VenueOrderBook = {
      venueId: this.venueId,
      marketKey: state.marketKey,
      bids,
      asks,
      exchangeTs: Number.isFinite(exchangeTs) ? exchangeTs : undefined,
      receivedTs: Date.now(),
      version: state.lastSeqnum,
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
      this.logger.log(`Bitmax orderbook snapshot deleted: symbol=${symbol}, key=${redisKey}`)
    } catch (error) {
      this.logger.warn(
        `Failed to delete Bitmax snapshot for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async fetchSnapshot(
    baseUrl: string,
    symbol: string,
    timeoutMs: number,
  ): Promise<BitmaxDepthData> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        // 获取频率限制令牌（最多等待 10 秒）
        await bitmaxRestApiRateLimiter.acquire(10_000)

        // 现货 API: GET /api/pro/v1/depth?symbol=BTC/USDT
        const url = new URL('/api/pro/v1/depth', baseUrl)
        url.searchParams.set('symbol', symbol)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

        try {
          const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            const error = new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)

            // 429 Too Many Requests: 指数退避重试
            if (res.status === 429 && attempt < maxRetries) {
              const backoffMs = 2 ** (attempt - 1) * 1000
              this.logger.warn(
                `Bitmax API rate limit (429) for ${symbol}, retry ${attempt}/${maxRetries} after ${backoffMs}ms`,
              )
              await this.sleep(backoffMs)
              lastError = error
              continue
            }

            throw error
          }
          const json = (await res.json()) as BitmaxRestResponse
          if (json.code !== 0) {
            throw new TypeError(`Bitmax REST error code=${json.code} msg=${json.message ?? 'unknown'}`)
          }
          const data = json.data?.data
          if (!data) {
            throw new TypeError('Bitmax REST depth response missing data')
          }
          return data
        } finally {
          clearTimeout(timeout)
        }
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries) {
          const backoffMs = 2 ** (attempt - 1) * 1000
          this.logger.warn(
            `Bitmax snapshot fetch failed for ${symbol}, retry ${attempt}/${maxRetries} after ${backoffMs}ms: ${
              lastError.message
            }`,
          )
          await this.sleep(backoffMs)
          continue
        }
      }
    }

    throw lastError ?? new DomainException(
      'data_sync.bitmax_orderbook_ws.fetch_snapshot_failed',
      { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: 'fetchSnapshot failed after retries' } },
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private levelsToMap(levels: BitmaxDepthLevel[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const [price, size] of levels) {
      const qty = Number(size)
      if (!Number.isFinite(qty) || qty <= 0) continue
      map.set(String(price), qty)
    }
    return map
  }

  private applyLevelsToMap(target: Map<string, number>, levels: BitmaxDepthLevel[]): void {
    for (const [price, size] of levels) {
      const qty = Number(size)
      const priceKey = String(price)
      if (!Number.isFinite(qty) || qty <= 0) target.delete(priceKey)
      else target.set(priceKey, qty)
    }
  }

  private mapToSortedLevels(
    map: Map<string, number>,
    side: 'bids' | 'asks',
    depthLevels: number,
  ): { price: number; size: number }[] {
    const entries: { price: number; size: number }[] = []
    for (const [price, size] of map.entries()) {
      const p = Number(price)
      if (!Number.isFinite(p) || !Number.isFinite(size) || size <= 0) continue
      entries.push({ price: p, size })
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

  private resolveSymbol(cfg: OrderbookPairConfig): string | null {
    const metadata = this.normalizeMetadata(cfg.metadata)
    const metaSymbol = this.pickMetadataString(metadata, ['bitmaxSymbol', 'ascendexSymbol', 'symbol'])
    if (metaSymbol) return metaSymbol.toUpperCase()

    const base = cfg.baseAsset.toUpperCase()
    const quote = cfg.quoteAsset.toUpperCase()

    // 现货格式: BTC/USDT
    if (this.instrumentType === 'SPOT') {
      return `${base}/${quote}`
    }

    // 永续格式: BTC-PERP
    if (this.instrumentType === 'PERPETUAL') {
      return `${base}-PERP`
    }

    // 期货格式: 需要从 metadata 获取合约代码，如 BTC-PERP-YYYYMMDD
    if (this.instrumentType === 'FUTURE') {
      const metaContract = this.pickMetadataString(metadata, ['bitmaxContract', 'contract'])
      if (metaContract) return metaContract.toUpperCase()
      // FUTURE 类型必须指定合约代码，缺失时记录警告并返回 null
      this.logger.warn(
        `FUTURE config missing bitmaxContract/contract in metadata, cannot resolve symbol: pairId=${cfg.pairId}`,
      )
      return null
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
}

class BitmaxWsConnection {
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
    private readonly onDepthMessage: (msg: BitmaxDepthMessage) => Promise<void>,
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

    for (const symbol of this.desired) {
      if (!this.active.has(symbol)) toSub.push(symbol)
    }
    for (const symbol of this.active) {
      if (!this.desired.has(symbol)) toUnsub.push(symbol)
    }

    if (toUnsub.length) {
      await this.sendSubscription('unsub', toUnsub)
      for (const symbol of toUnsub) this.active.delete(symbol)
    }
    if (toSub.length) {
      await this.sendSubscription('sub', toSub)
      for (const symbol of toSub) this.active.add(symbol)
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
    const logger = this.baseLogger

    logger.log(`Connecting Bitmax WS#${this.index}: ${wsBaseUrl}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(wsBaseUrl)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`Bitmax WS#${this.index} connected`)
      this.startHeartbeat()
      void this.resubscribeOnOpen()
    })

    this.ws.on('message', data => {
      this.handleRawMessage(data)
    })

    this.ws.on('close', (code, reason) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.warn(`Bitmax WS#${this.index} closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(`Bitmax WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`)
      this.scheduleReconnect()
    })
  }

  private async resubscribeOnOpen(): Promise<void> {
    if (!this.open || !this.ws) return
    this.active.clear()
    const streams = [...this.desired]
    if (!streams.length) return
    await this.sendSubscription('sub', streams)
    for (const symbol of streams) this.active.add(symbol)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delayMs = this.configService.get<number>('marketData.wsReconnectDelayMs') ?? 5_000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, Math.max(1_000, delayMs))
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    const intervalMs = this.configService.get<number>('ORDERBOOK_WS_HEARTBEAT_INTERVAL_MS') ?? 15_000
    const timeoutMs = this.configService.get<number>('ORDERBOOK_WS_HEARTBEAT_TIMEOUT_MS') ?? 45_000

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws) return
      const now = Date.now()
      if (now - this.lastPongTs > timeoutMs) {
        try {
          this.baseLogger.warn(`Bitmax WS#${this.index} heartbeat timeout, terminating`)
          this.ws.terminate()
        } catch {}
        return
      }
      // 客户端主动发 ping
      try {
        this.ws.send(JSON.stringify({ op: 'ping' }))
      } catch {}
    }, Math.max(5_000, intervalMs))
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private async sendSubscription(op: 'sub' | 'unsub', symbols: string[]): Promise<void> {
    if (!this.ws || !this.open || !symbols.length) return
    // Bitmax 订阅格式: {"op":"sub", "id":"xxx", "ch":"depth:BTC-PERP"}
    // AscendEX 不支持批量订阅，使用 Promise.all 并行发送减少延迟
    const promises = symbols.map(symbol => {
      const payload = {
        op,
        id: String(this.requestId++),
        ch: `depth:${symbol}`,
      }
      return this.send(payload)
    })
    await Promise.all(promises)
  }

  private async send(payload: unknown): Promise<void> {
    if (!this.ws || !this.open) return
    try {
      this.ws.send(JSON.stringify(payload))
    } catch {}
  }

  private handleRawMessage(data: WebSocket.RawData): void {
    const text = data.toString()
    let msg: BitmaxDepthMessage
    try {
      msg = JSON.parse(text) as BitmaxDepthMessage
    } catch (err) {
      // 记录 JSON 解析失败的消息内容（截取前 200 字符），便于调试协议问题
      this.baseLogger.debug(
        `Bitmax WS#${this.index} JSON parse error: ${err instanceof Error ? err.message : String(err)}, raw=${text.slice(0, 200)}`,
      )
      return
    }

    // 处理 ping 消息，回复 pong
    if (msg.m === 'ping') {
      this.lastPongTs = Date.now()
      if (this.ws && this.open) {
        try {
          this.ws.send(JSON.stringify({ op: 'pong' }))
        } catch {}
      }
      return
    }

    // 处理 pong 响应
    if (msg.m === 'pong') {
      this.lastPongTs = Date.now()
      return
    }

    // 处理订阅确认
    if (msg.m === 'sub' || msg.m === 'unsub') {
      return
    }

    // 处理连接消息
    if (msg.m === 'connected') {
      this.lastPongTs = Date.now()
      return
    }

    // 处理错误
    if (msg.m === 'error') {
      this.baseLogger.warn(`Bitmax WS#${this.index} error: code=${msg.code} reason=${msg.reason}`)
      return
    }

    // 处理 depth 消息
    if (msg.m === 'depth' || msg.m === 'depth-snapshot') {
      void this.onDepthMessage(msg).catch(err => {
        this.baseLogger.error(
          `Bitmax WS#${this.index} onDepthMessage error: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }
  }
}
