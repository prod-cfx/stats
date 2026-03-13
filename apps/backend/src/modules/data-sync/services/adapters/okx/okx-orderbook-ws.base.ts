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

type OkxDepthLevel = [string, string, string?, string?, string?]

interface OkxBooksEntry {
  asks: OkxDepthLevel[]
  bids: OkxDepthLevel[]
  ts: string
  seqId?: string
  prevSeqId?: string
}

interface OkxBooksMessage {
  arg?: {
    channel?: string
    instId?: string
  }
  action?: 'snapshot' | 'update'
  data?: OkxBooksEntry[]
  event?: string
  code?: string
  msg?: string
}

interface OkxRestResponse {
  code: string
  msg: string
  data?: OkxBooksEntry[]
}

interface BufferedEvent {
  action?: 'snapshot' | 'update'
  entry: OkxBooksEntry
}

interface BookState {
  cfg: OrderbookPairConfig
  instId: string
  marketKey: string
  bids: Map<string, number>
  asks: Map<string, number>
  lastSeqId: number
  buffer: BufferedEvent[]
  isReady: boolean
  lastPublishTs: number
}

@Injectable()
export abstract class OkxOrderbookWsAdapterBase implements OrderbookWsAdapter {
  abstract readonly key: OrderbookAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract getWsBaseUrl(): string
  protected abstract getRestBaseUrl(): string
  protected abstract getWsChannel(): string
  protected abstract getMaxStreamsPerConnection(): number

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: OkxWsConnection[] = []
  private readonly states = new Map<string, BookState>() // instId -> state
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
        cfg.venue.toUpperCase() === 'OKX' &&
        cfg.venueType === 'CEX' &&
        cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => a.priority - b.priority)

    const desiredInstIds = new Map<string, OrderbookPairConfig>() // instId -> cfg
    for (const cfg of targets) {
      const instId = this.resolveInstId(cfg)
      if (!instId) {
        this.logger.warn(`Orderbook config missing OKX instId mapping, skip: pairId=${cfg.pairId}`)
        continue
      }
      desiredInstIds.set(instId, cfg)
    }

    // remove stale states
    for (const instId of [...this.states.keys()]) {
      if (!desiredInstIds.has(instId)) {
        const state = this.states.get(instId)
        this.states.delete(instId)
        await this.deleteRedisSnapshot(instId, state)
      }
    }

    const newInstIds: string[] = []

    for (const [instId, cfg] of desiredInstIds.entries()) {
      const state = this.states.get(instId)
      if (!state) {
        const created: BookState = {
          cfg,
          instId,
          marketKey: toMarketKey(this.toMarketIdFromConfig(cfg)),
          bids: new Map(),
          asks: new Map(),
          lastSeqId: 0,
          buffer: [],
          isReady: false,
          lastPublishTs: 0,
        }
        this.states.set(instId, created)
        newInstIds.push(instId)
      } else {
        state.cfg = cfg
      }
    }

    await this.reconcileSubscriptions([...desiredInstIds.keys()])

    for (const instId of newInstIds) {
      const state = this.states.get(instId)
      if (state) {
        await this.initSnapshot(instId, state)
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

  protected streamNameForInstId(instId: string): string {
    return instId
  }

  private async ensureConnections(count: number): Promise<void> {
    if (!this.redis) this.redis = this.redisService.getClient()

    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new OkxWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        (msg) => this.onMessage(msg),
        () => this.getWsChannel(),
      )
      this.connections.push(conn)
    }

    while (this.connections.length > count) {
      const conn = this.connections.pop()
      if (conn) conn.shutdown()
    }

    await Promise.allSettled(this.connections.map(c => c.ensureConnected()))
  }

  private async reconcileSubscriptions(instIds: string[]): Promise<void> {
    const perConn = Math.max(1, Math.floor(this.getMaxStreamsPerConnection()))

    const instSet = new Set(instIds.map(id => id.toUpperCase()))
    const streams = [...instSet].sort((a, b) => a.localeCompare(b))

    const chunks: string[][] = []
    for (let i = 0; i < streams.length; i += perConn) {
      chunks.push(streams.slice(i, i + perConn))
    }

    await this.ensureConnections(Math.max(1, chunks.length))

    await Promise.allSettled(
      this.connections.map((conn, idx) => conn.syncDesiredStreams(new Set(chunks[idx] ?? []))),
    )
  }

  private async onMessage(msg: OkxBooksMessage): Promise<void> {
    const arg = msg.arg
    if (!arg || typeof arg.instId !== 'string') return
    if (arg.channel !== this.getWsChannel()) return

    if (!Array.isArray(msg.data) || !msg.data.length) return
    const entry = msg.data[0]
    const instId = arg.instId.toUpperCase()
    const state = this.states.get(instId)
    if (!state) return

    if (!state.isReady) {
      state.buffer.push({ action: msg.action, entry })
      if (state.buffer.length > 1000) state.buffer.shift()
      return
    }

    await this.applyEntry(instId, state, msg.action ?? 'update', entry)
  }

  private async initSnapshot(instId: string, state: BookState): Promise<void> {
    const restBaseUrl = this.getRestBaseUrl()
    const timeoutMs = this.configService.get<number>('marketData.restTimeoutMs') ?? 10_000
    const limit = state.cfg.depthLevels ?? 100

    try {
      const entry = await this.fetchSnapshot(restBaseUrl, instId, timeoutMs, limit)
      this.applySnapshotState(state, entry)
      state.isReady = true
      await this.publish(instId, state, Number(entry.ts))

      if (state.buffer.length) {
        const buffered = state.buffer
        state.buffer = []
        for (const evt of buffered) {
          await this.applyEntry(instId, state, evt.action ?? 'update', evt.entry)
        }
      }
    } catch (error) {
      state.isReady = false
      this.states.delete(instId)
      await this.deleteRedisSnapshot(instId, state)
      this.logger.error(
        `Failed to init OKX snapshot for ${instId}, will retry on next sync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private applySnapshotState(state: BookState, entry: OkxBooksEntry): void {
    state.bids = this.levelsToMap(entry.bids)
    state.asks = this.levelsToMap(entry.asks)
    state.lastSeqId = this.parseSeq(entry.seqId) ?? 0
  }

  private async applyEntry(
    instId: string,
    state: BookState,
    action: 'snapshot' | 'update',
    entry: OkxBooksEntry,
  ): Promise<void> {
    const seqId = this.parseSeq(entry.seqId)
    const prevSeqId = this.parseSeq(entry.prevSeqId)

    if (action === 'snapshot') {
      this.applySnapshotState(state, entry)
    } else {
      if (state.lastSeqId && prevSeqId && prevSeqId !== state.lastSeqId) {
        this.logger.warn(
          `OKX depth sequence gap for ${instId}: last=${state.lastSeqId}, prev=${prevSeqId}, seq=${seqId ?? -1}, resync`,
        )
        await this.resync(instId, state, entry)
        return
      }
      this.applyLevelsToMap(state.bids, entry.bids)
      this.applyLevelsToMap(state.asks, entry.asks)
      if (seqId) state.lastSeqId = seqId
    }

    const publishIntervalMs = this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()
    if (now - state.lastPublishTs >= publishIntervalMs) {
      state.lastPublishTs = now
      await this.publish(instId, state, Number(entry.ts))
    }
  }

  private async resync(instId: string, state: BookState, firstEvent?: OkxBooksEntry): Promise<void> {
    state.isReady = false
    state.buffer = []
    if (firstEvent) {
      state.buffer.push({ action: 'update', entry: firstEvent })
    }
    await this.initSnapshot(instId, state)
  }

  private async publish(instId: string, state: BookState, exchangeTs?: number): Promise<void> {
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
      version: state.lastSeqId,
    }

    const redisKey = this.buildRedisKey(book.venueId, book.marketKey)
    await this.redis.set(redisKey, JSON.stringify(book))
  }

  private buildRedisKey(venueId: string, marketKey: string): string {
    return `orderbook:${venueId}:${marketKey}`
  }

  private async deleteRedisSnapshot(instId: string, state?: BookState): Promise<void> {
    if (!this.redis || !state) return
    const redisKey = this.buildRedisKey(this.venueId, state.marketKey)
    try {
      await this.redis.del(redisKey)
      this.logger.log(`OKX orderbook snapshot deleted: instId=${instId}, key=${redisKey}`)
    } catch (error) {
      this.logger.warn(
        `Failed to delete OKX snapshot for ${instId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async fetchSnapshot(
    baseUrl: string,
    instId: string,
    timeoutMs: number,
    depthLevels: number,
  ): Promise<OkxBooksEntry> {
    const url = new URL('/api/v5/market/books', baseUrl)
    url.searchParams.set('instId', instId)
    const sz = Math.min(Math.max(depthLevels, 1), 400)
    url.searchParams.set('sz', String(sz))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 10_000)

    try {
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeError(`HTTP ${res.status} ${res.statusText} body=${text.slice(0, 200)}`)
      }
      const json = (await res.json()) as OkxRestResponse
      if (json.code !== '0') {
        throw new TypeError(`OKX REST error code=${json.code} msg=${json.msg ?? 'unknown'}`)
      }
      const entry = json.data?.[0]
      if (!entry) {
        throw new TypeError('OKX REST depth response missing data')
      }
      return entry
    } finally {
      clearTimeout(timeout)
    }
  }

  private levelsToMap(levels: OkxDepthLevel[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const [price, size] of levels) {
      const qty = Number(size)
      if (!Number.isFinite(qty) || qty <= 0) continue
      map.set(String(price), qty)
    }
    return map
  }

  private applyLevelsToMap(target: Map<string, number>, levels: OkxDepthLevel[]): void {
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

  private parseSeq(seq?: string): number | null {
    if (!seq) return null
    const num = Number(seq)
    return Number.isFinite(num) ? num : null
  }

  private resolveInstId(cfg: OrderbookPairConfig): string | null {
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

class OkxWsConnection {
  private ws: WebSocket | null = null
  private open = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTs = 0
  private desired = new Set<string>()
  private active = new Set<string>()

  constructor(
    private readonly index: number,
    private readonly configService: ConfigService,
    private readonly baseLogger: Logger,
    private readonly getWsBaseUrl: () => string,
    private readonly onBooksMessage: (msg: OkxBooksMessage) => Promise<void>,
    private readonly getChannel: () => string,
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

    for (const instId of this.desired) {
      if (!this.active.has(instId)) toSub.push(instId)
    }
    for (const instId of this.active) {
      if (!this.desired.has(instId)) toUnsub.push(instId)
    }

    if (toUnsub.length) {
      await this.sendSubscription('unsubscribe', toUnsub)
      for (const instId of toUnsub) this.active.delete(instId)
    }
    if (toSub.length) {
      await this.sendSubscription('subscribe', toSub)
      for (const instId of toSub) this.active.add(instId)
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

    logger.log(`Connecting OKX WS#${this.index}: ${wsBaseUrl}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(wsBaseUrl)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`OKX WS#${this.index} connected`)
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
      logger.warn(`OKX WS#${this.index} closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(`OKX WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`)
      this.scheduleReconnect()
    })
  }

  private async resubscribeOnOpen(): Promise<void> {
    if (!this.open || !this.ws) return
    this.active.clear()
    const streams = [...this.desired]
    if (!streams.length) return
    await this.sendSubscription('subscribe', streams)
    for (const instId of streams) this.active.add(instId)
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
          this.baseLogger.warn(`OKX WS#${this.index} heartbeat timeout, terminating`)
          this.ws.terminate()
        } catch {}
        return
      }
      try {
        this.ws.send('ping')
      } catch {}
    }, Math.max(5_000, intervalMs))
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private async sendSubscription(op: 'subscribe' | 'unsubscribe', instIds: string[]): Promise<void> {
    if (!this.ws || !this.open || !instIds.length) return
    const channel = this.getChannel()
    const chunkSize = 20
    for (let i = 0; i < instIds.length; i += chunkSize) {
      const chunk = instIds.slice(i, i + chunkSize)
      const payload = {
        op,
        args: chunk.map(instId => ({ channel, instId })),
      }
      await this.send(payload)
    }
  }

  private async send(payload: unknown): Promise<void> {
    if (!this.ws || !this.open) return
    try {
      this.ws.send(JSON.stringify(payload))
    } catch {}
  }

  private handleRawMessage(data: WebSocket.RawData): void {
    const text = data.toString()
    if (text === 'pong') {
      this.lastPongTs = Date.now()
      return
    }
    if (text === 'ping') {
      if (this.ws && this.open) {
        try {
          this.ws.send('pong')
        } catch {}
      }
      return
    }

    let msg: OkxBooksMessage
    try {
      msg = JSON.parse(text) as OkxBooksMessage
    } catch {
      return
    }

    if (msg.event === 'error') {
      this.baseLogger.warn(`OKX WS#${this.index} error event: code=${msg.code} msg=${msg.msg}`)
      return
    }
    if (msg.event === 'subscribe' || msg.event === 'unsubscribe' || msg.event === 'pong') {
      this.lastPongTs = Date.now()
      return
    }

    if (msg.arg && msg.data) {
      void this.onBooksMessage(msg).catch(err => {
        this.baseLogger.error(
          `OKX WS#${this.index} onBooksMessage error: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }
  }
}

