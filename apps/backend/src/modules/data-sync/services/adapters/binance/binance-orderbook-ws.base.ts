/* eslint-disable perfectionist/sort-imports */

import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import type { OrderbookPairConfig } from '@prisma/client'
import WebSocket from 'ws'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import type { OrderbookAdapterKey, OrderbookWsAdapter } from '../../orderbook-ws-adapter'
import { RedisService } from '@/common/services/redis.service'

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

interface BookState {
  cfg: OrderbookPairConfig
  marketKey: string
  bids: Map<string, number>
  asks: Map<string, number>
  lastUpdateId: number
  buffer: BinanceDepthUpdateEvent[]
  isReady: boolean
  lastPublishTs: number
}

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
        this.states.delete(symbol)
      }
    }

    const newSymbols: string[] = []

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
          lastPublishTs: 0,
        }
        this.states.set(symbol, created)
        newSymbols.push(symbol)
      } else {
        state.cfg = cfg
      }
    }

    // 1) 先同步订阅（确保 diff 可缓冲）
    await this.reconcileSubscriptions([...targetSymbols.keys()])

    // 2) 再初始化 snapshot
    for (const symbol of newSymbols) {
      const state = this.states.get(symbol)
      if (state) {
        await this.initSnapshot(symbol, state)
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
        (raw) => this.onMessage(raw),
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

    const streams = symbols
      .map(s => this.streamNameForSymbol(s))
      .sort((a, b) => a.localeCompare(b))

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
    const limit = cfg.depthLevels ?? 100

    try {
      const snapshot = await this.fetchSnapshot(restBaseUrl, symbol, timeoutMs, limit)
      state.bids = this.levelsToMap(snapshot.bids)
      state.asks = this.levelsToMap(snapshot.asks)
      state.lastUpdateId = snapshot.lastUpdateId
      state.isReady = true

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
      // 移除该 symbol 的 state，让下次 syncTargetConfigs 重新尝试 snapshot 初始化
      this.states.delete(symbol)
      this.logger.error(
        `Failed to init snapshot for ${symbol}, state removed and will retry on next sync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async applyUpdate(symbol: string, state: BookState, evt: BinanceDepthUpdateEvent): Promise<void> {
    if (evt.u <= state.lastUpdateId) return
    const expected = state.lastUpdateId + 1
    if (!(evt.U <= expected && expected <= evt.u)) {
      this.logger.warn(
        `Depth sequence gap for ${symbol}: last=${state.lastUpdateId}, U=${evt.U}, u=${evt.u}, resync`,
      )
      state.isReady = false
      state.buffer = [evt]
      await this.initSnapshot(symbol, state)
      return
    }

    this.applyLevelsToMap(state.bids, evt.b)
    this.applyLevelsToMap(state.asks, evt.a)
    state.lastUpdateId = evt.u

    const publishIntervalMs = this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()
    if (now - state.lastPublishTs >= publishIntervalMs) {
      state.lastPublishTs = now
      await this.publish(symbol, state, evt.E)
    }
  }

  private async publish(_symbol: string, state: BookState, exchangeTs: number): Promise<void> {
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

  private async fetchSnapshot(
    baseUrl: string,
    symbol: string,
    timeoutMs: number,
    limit: number,
  ): Promise<BinanceDepthSnapshotResponse> {
    const url = new URL(this.getRestDepthPath(), baseUrl)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('limit', String(limit > 0 ? limit : 100))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

    try {
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)
      }
      return (await res.json()) as BinanceDepthSnapshotResponse
    } finally {
      clearTimeout(timeout)
    }
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

    this.ws.on('message', (data) => {
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

    this.ws.on('error', (err) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(`Binance WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`)
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
          this.baseLogger.warn(`Binance WS#${this.index} heartbeat timeout, terminating`)
          this.ws.terminate()
        } catch {}
        return
      }
      try {
        this.ws.ping()
      } catch {}
    }, Math.max(5_000, intervalMs))
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

