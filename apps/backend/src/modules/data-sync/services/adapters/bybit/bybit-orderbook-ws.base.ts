/* eslint-disable perfectionist/sort-imports */

import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import type { OrderbookPairConfig } from '@/prisma/prisma.types'
import WebSocket from 'ws'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import type { OrderbookAdapterKey, OrderbookWsAdapter } from '../../orderbook-ws-adapter'
import { RedisService } from '@/common/services/redis.service'

type BybitDepthLevel = [string, string]

type BybitMarketCategory = 'spot' | 'linear' | 'inverse'

interface BybitDepthPayload {
  s: string
  b?: BybitDepthLevel[]
  a?: BybitDepthLevel[]
  u: number
  seq?: number
  ts?: number
  cts?: number
  pu?: number
}

interface BybitOrderbookApiResponse {
  retCode: number
  retMsg: string
  result?: BybitDepthPayload
}

interface BybitWsMessage {
  topic?: string
  type?: 'snapshot' | 'delta'
  ts?: number
  cts?: number
  data?: BybitDepthPayload | BybitDepthPayload[]
}

interface BookState {
  cfg: OrderbookPairConfig
  marketKey: string
  bids: Map<string, number>
  asks: Map<string, number>
  lastUpdateId: number
  lastSeq: number
  buffer: BybitOrderbookEvent[]
  isReady: boolean
  lastPublishTs: number
}

interface BybitOrderbookEvent {
  type: 'snapshot' | 'delta'
  data: BybitDepthPayload
  ts?: number
  cts?: number
}

/**
 * Bybit 订单薄 WS 同步基类：
 * - 负责订阅/退订 orderbook.{depth}.{symbol}
 * - snapshot + delta 合流，缺档自动重建
 * - 将标准化后的订单薄写入 Redis
 */
@Injectable()
export abstract class BybitOrderbookWsAdapterBase implements OrderbookWsAdapter {
  abstract readonly key: OrderbookAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract readonly category: BybitMarketCategory

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: BybitWsConnection[] = []
  private readonly states = new Map<string, BookState>()
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
      .filter(cfg => cfg.venue.toUpperCase() === 'BYBIT' && cfg.venueType === 'CEX' && cfg.instrumentType === this.instrumentType)
      .sort((a, b) => a.priority - b.priority)

    const targetSymbols = new Map<string, OrderbookPairConfig>()
    for (const cfg of targets) {
      targetSymbols.set(cfg.symbol.toUpperCase(), cfg)
    }

    for (const symbol of [...this.states.keys()]) {
      if (!targetSymbols.has(symbol)) {
        const state = this.states.get(symbol)
        this.states.delete(symbol)
        await this.deleteRedisSnapshot(symbol, state)
      }
    }

    const newSymbols: string[] = []

    for (const [symbol, cfg] of targetSymbols.entries()) {
      const state = this.states.get(symbol)
      if (!state) {
        const created: BookState = {
          cfg,
          marketKey: toMarketKey(this.toMarketIdFromConfig(cfg)),
          bids: new Map(),
          asks: new Map(),
          lastUpdateId: 0,
          lastSeq: 0,
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

    await this.reconcileSubscriptions([...targetSymbols.keys()])

    for (const symbol of newSymbols) {
      const state = this.states.get(symbol)
      if (state) await this.initSnapshot(symbol, state)
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

  protected streamNameForConfig(cfg: OrderbookPairConfig): string {
    const depth = this.resolveChannelDepth(cfg.depthLevels ?? undefined)
    return `orderbook.${depth}.${cfg.symbol.toUpperCase()}`
  }

  protected getWsBaseUrl(): string {
    const categoryKey = `ORDERBOOK_WS_BYBIT_${this.category.toUpperCase()}_WS_URL`
    return (
      this.configService.get<string>(categoryKey) ??
      this.configService.get<string>('ORDERBOOK_WS_BYBIT_WS_URL') ??
      `wss://stream.bybit.com/v5/public/${this.category}`
    )
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('ORDERBOOK_WS_BYBIT_REST_BASE_URL') ?? 'https://api.bybit.com'
  }

  protected getRestDepthPath(): string {
    return '/v5/market/orderbook'
  }

  protected getMaxTopicsPerConnection(): number {
    const categoryKey = `ORDERBOOK_WS_BYBIT_${this.category.toUpperCase()}_MAX_TOPICS_PER_CONNECTION`
    const fallback = this.category === 'spot' ? 10 : 25
    return (
      this.configService.get<number>(categoryKey) ??
      this.configService.get<number>('ORDERBOOK_WS_BYBIT_MAX_TOPICS_PER_CONNECTION') ??
      fallback
    )
  }

  protected getMaxTopicsPerMessage(): number {
    const categoryKey = `ORDERBOOK_WS_BYBIT_${this.category.toUpperCase()}_MAX_TOPICS_PER_MESSAGE`
    const fallback = this.category === 'spot' ? 5 : 10
    return (
      this.configService.get<number>(categoryKey) ??
      this.configService.get<number>('ORDERBOOK_WS_BYBIT_MAX_TOPICS_PER_MESSAGE') ??
      fallback
    )
  }

  protected resolveSnapshotLimit(depthLevels?: number): number {
    const requested = depthLevels ?? 50
    const max = this.category === 'spot' ? 200 : 500
    return Math.min(Math.max(1, requested), max)
  }

  private async ensureConnections(count: number): Promise<void> {
    if (!this.redis) this.redis = this.redisService.getClient()

    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new BybitWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        (raw) => {
          void this.onMessage(raw)
        },
        this.getMaxTopicsPerMessage(),
      )
      this.connections.push(conn)
    }

    while (this.connections.length > count) {
      const conn = this.connections.pop()
      if (conn) conn.shutdown()
    }

    await Promise.allSettled(this.connections.map(conn => conn.ensureConnected()))
  }

  private async reconcileSubscriptions(symbols: string[]): Promise<void> {
    const perConn = Math.max(1, Math.floor(this.getMaxTopicsPerConnection()))
    const topics = symbols.map(symbol => this.streamNameForSymbol(symbol)).sort((a, b) => a.localeCompare(b))

    const chunks: string[][] = []
    for (let i = 0; i < topics.length; i += perConn) {
      chunks.push(topics.slice(i, i + perConn))
    }

    await this.ensureConnections(Math.max(1, chunks.length || 1))
    await Promise.allSettled(
      this.connections.map((conn, idx) => conn.syncDesiredTopics(new Set(chunks[idx] ?? []))),
    )
  }

  private streamNameForSymbol(symbol: string): string {
    const cfg = this.states.get(symbol)?.cfg
    if (!cfg) return `orderbook.50.${symbol}`
    return this.streamNameForConfig(cfg)
  }

  private async onMessage(raw: WebSocket.RawData): Promise<void> {
    let msg: BybitWsMessage
    try {
      msg = JSON.parse(raw.toString()) as BybitWsMessage
    } catch {
      return
    }

    if (!msg || typeof msg.topic !== 'string' || (msg.type !== 'snapshot' && msg.type !== 'delta')) {
      return
    }

    if (!msg.topic.startsWith('orderbook.')) return

    const payloads = Array.isArray(msg.data) ? msg.data : msg.data ? [msg.data] : []
    if (!payloads.length) return

    for (const payload of payloads) {
      if (!payload || typeof payload.s !== 'string') continue
      const symbol = payload.s.toUpperCase()
      const state = this.states.get(symbol)
      if (!state) continue

      const event: BybitOrderbookEvent = {
        type: msg.type,
        data: payload,
        ts: payload.ts ?? msg.ts,
        cts: payload.cts ?? msg.cts,
      }

      if (!state.isReady) {
        state.buffer.push(event)
        if (state.buffer.length > 1_000) state.buffer.shift()
        continue
      }

      await this.applyEvent(symbol, state, event)
    }
  }

  private async initSnapshot(symbol: string, state: BookState): Promise<void> {
    const restBaseUrl = this.getRestBaseUrl()
    const timeoutMs = this.configService.get<number>('marketData.restTimeoutMs') ?? 10_000
    const limit = this.resolveSnapshotLimit(state.cfg.depthLevels ?? undefined)

    try {
      const snapshot = await this.fetchSnapshot(restBaseUrl, symbol, timeoutMs, limit)
      this.applySnapshotState(state, snapshot)

      if (state.buffer.length) {
        const buffered = state.buffer
        state.buffer = []
        buffered.sort((a, b) => (a.data.u ?? 0) - (b.data.u ?? 0))
        for (const event of buffered) {
          if (event.data.u <= state.lastUpdateId) continue
          await this.applyEvent(symbol, state, event)
        }
      }

      await this.publish(symbol, state, snapshot.cts ?? snapshot.ts ?? Date.now())
    } catch (error) {
      state.isReady = false
      this.states.delete(symbol)
      await this.deleteRedisSnapshot(symbol, state)
      this.logger.error(
        `Failed to init Bybit snapshot for ${symbol}, will retry on next sync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async applyEvent(symbol: string, state: BookState, event: BybitOrderbookEvent): Promise<void> {
    if (event.type === 'snapshot') {
      this.applySnapshotState(state, event.data)
      await this.publish(symbol, state, event.cts ?? event.ts ?? Date.now())
      return
    }

    if (event.data.u <= state.lastUpdateId) return

    if (typeof event.data.pu === 'number') {
      if (event.data.pu !== state.lastUpdateId) {
        await this.resync(symbol, state, `pu mismatch: last=${state.lastUpdateId}, pu=${event.data.pu}, u=${event.data.u}`)
        return
      }
    }

    this.applyLevelsToMap(state.bids, event.data.b ?? [])
    this.applyLevelsToMap(state.asks, event.data.a ?? [])
    state.lastUpdateId = event.data.u
    if (typeof event.data.seq === 'number') state.lastSeq = event.data.seq

    const publishIntervalMs = this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()
    if (now - state.lastPublishTs >= publishIntervalMs) {
      state.lastPublishTs = now
      await this.publish(symbol, state, event.cts ?? event.ts ?? now)
    }
  }

  private applySnapshotState(state: BookState, snapshot: BybitDepthPayload): void {
    state.bids = this.levelsToMap(snapshot.b ?? [])
    state.asks = this.levelsToMap(snapshot.a ?? [])
    state.lastUpdateId = snapshot.u
    state.lastSeq = snapshot.seq ?? 0
    state.isReady = true
  }

  private async resync(symbol: string, state: BookState, reason: string): Promise<void> {
    this.logger.warn(`Bybit depth sequence issue for ${symbol}: ${reason}, resync snapshot`)
    state.isReady = false
    state.buffer = []
    await this.initSnapshot(symbol, state)
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

  private async deleteRedisSnapshot(symbol: string, state?: BookState): Promise<void> {
    if (!this.redis || !state) return
    const redisKey = this.buildRedisKey(this.venueId, state.marketKey)
    try {
      await this.redis.del(redisKey)
      this.logger.log(`Bybit orderbook snapshot deleted: symbol=${symbol}, key=${redisKey}`)
    } catch (error) {
      this.logger.warn(
        `Failed to delete Bybit orderbook snapshot for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async fetchSnapshot(
    baseUrl: string,
    symbol: string,
    timeoutMs: number,
    limit: number,
  ): Promise<BybitDepthPayload> {
    const url = new URL(this.getRestDepthPath(), baseUrl)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('category', this.category)
    url.searchParams.set('limit', String(Math.max(1, limit)))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

    try {
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)
      }
      const json = (await res.json()) as BybitOrderbookApiResponse
      if (json.retCode !== 0 || !json.result) {
        throw new TypeError(`Invalid Bybit response: retCode=${json.retCode} retMsg=${json.retMsg}`)
      }
      return json.result
    } finally {
      clearTimeout(timeout)
    }
  }

  private levelsToMap(levels: BybitDepthLevel[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const [price, qty] of levels) {
      const size = Number(qty)
      if (!Number.isFinite(size) || size <= 0) continue
      map.set(String(price), size)
    }
    return map
  }

  private applyLevelsToMap(target: Map<string, number>, levels: BybitDepthLevel[]): void {
    for (const [price, qty] of levels) {
      const size = Number(qty)
      const key = String(price)
      if (!Number.isFinite(size) || size <= 0) target.delete(key)
      else target.set(key, size)
    }
  }

  private mapToSortedLevels(
    map: Map<string, number>,
    side: 'bids' | 'asks',
    depthLevels: number,
  ): { price: number; size: number }[] {
    const entries: { price: number; size: number }[] = []
    for (const [price, size] of map.entries()) {
      const parsedPrice = Number(price)
      if (!Number.isFinite(parsedPrice) || !Number.isFinite(size) || size <= 0) continue
      entries.push({ price: parsedPrice, size })
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

    const keep = new Set(items.slice(0, keepN).map(item => item.key))
    for (const key of map.keys()) {
      if (!keep.has(key)) map.delete(key)
    }
  }

  private resolveChannelDepth(depthLevels?: number): 1 | 50 | 200 {
    if (!depthLevels || depthLevels >= 200) return 200
    if (depthLevels <= 1) return 1
    return depthLevels <= 50 ? 50 : 200
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

class BybitWsConnection {
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
    private readonly maxTopicsPerMessage: number,
  ) {}

  async ensureConnected(): Promise<void> {
    if (this.open && this.ws) return
    await this.connect()
  }

  async syncDesiredTopics(desired: Set<string>): Promise<void> {
    this.desired = desired
    if (!this.open || !this.ws) return

    const toSub: string[] = []
    const toUnsub: string[] = []

    for (const topic of this.desired) {
      if (!this.active.has(topic)) toSub.push(topic)
    }
    for (const topic of this.active) {
      if (!this.desired.has(topic)) toUnsub.push(topic)
    }

    if (toUnsub.length) {
      this.sendTopics('unsubscribe', toUnsub)
      for (const topic of toUnsub) this.active.delete(topic)
    }
    if (toSub.length) {
      this.sendTopics('subscribe', toSub)
      for (const topic of toSub) this.active.add(topic)
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

    const url = this.getWsBaseUrl()
    const logger = this.baseLogger

    logger.log(`Connecting Bybit WS#${this.index}: ${url}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`Bybit WS#${this.index} connected`)
      this.startHeartbeat()
      void this.resubscribeAll()
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
      logger.warn(`Bybit WS#${this.index} closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(`Bybit WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`)
      this.scheduleReconnect()
    })
  }

  private async resubscribeAll(): Promise<void> {
    if (!this.open || !this.ws) return
    this.active.clear()
    const topics = [...this.desired]
    if (!topics.length) return
    this.sendTopics('subscribe', topics)
    for (const topic of topics) this.active.add(topic)
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
          this.baseLogger.warn(`Bybit WS#${this.index} heartbeat timeout, terminating`)
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

  private sendTopics(op: 'subscribe' | 'unsubscribe', topics: string[]): void {
    if (!this.ws || !this.open || !topics.length) return
    const chunkSize = Math.max(1, Math.floor(this.maxTopicsPerMessage))
    for (let i = 0; i < topics.length; i += chunkSize) {
      const args = topics.slice(i, i + chunkSize)
      const payload = {
        op,
        args,
        req_id: `${op}-${this.index}-${this.requestId++}`,
      }
      this.send(payload)
    }
  }

  private send(payload: unknown): void {
    if (!this.ws || !this.open) return
    try {
      this.ws.send(JSON.stringify(payload))
    } catch {}
  }
}
