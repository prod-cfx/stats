/* eslint-disable perfectionist/sort-imports */

import WebSocket from 'ws'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { TradesAdapterKey, TradesConfig, TradesWsAdapter } from '../../trades-ws-adapter'
import { PrismaService } from '@/prisma/prisma.service'
import { MarketTradesRepository } from '@/modules/markets/repositories/market-trades.repository'

interface OkxTradeData {
  instId: string
  tradeId: string
  px: string
  sz: string
  side: 'buy' | 'sell'
  ts: string
}

interface OkxTradesMessage {
  arg?: {
    channel?: string
    instId?: string
  }
  data?: OkxTradeData[]
  event?: string
  code?: string
  msg?: string
}

interface TradeState {
  cfg: TradesConfig
  instId: string
  buffer: OkxTradeData[]
  isReady: boolean
  lastSeenTradeId: string | null
  /**
   * 最近一次将缓冲区刷入数据库的时间戳（ms）
   * 用于时间驱动的 flush，避免低频交易对长期滞留在内存
   */
  lastFlushAt: number
  /**
   * 当前是否有正在进行的 flush 操作，用于串行化同一 instId 的落库
   */
  flushPromise?: Promise<boolean> | null
}

@Injectable()
export abstract class OkxTradesWsAdapterBase implements TradesWsAdapter {
  abstract readonly key: TradesAdapterKey

  protected abstract readonly exchange: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract getWsBaseUrl(): string
  protected abstract getWsChannel(): string
  protected abstract getMaxStreamsPerConnection(): number

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: OkxWsConnection[] = []
  private readonly states = new Map<string, TradeState>() // instId -> state
  private flushTicker: NodeJS.Timeout | null = null
  private flushTickRunning = false
  private readonly maxTradesPerSymbol: number
  private readonly lastTrimTime = new Map<string, number>()
  private readonly retryCount = new Map<string, number>()
  private readonly TRIM_THROTTLE_MS = 300_000

  constructor(
    @Inject(ConfigService)
    protected readonly configService: ConfigService,
    @Inject(PrismaService)
    protected readonly prismaService: PrismaService,
    @Inject(MarketTradesRepository)
    protected readonly marketTradesRepository: MarketTradesRepository,
  ) {
    const raw = this.configService.get<string>('TRADES_MAX_COUNT_PER_SYMBOL')
    const parsed = raw != null ? Number(raw) : Number.NaN
    this.maxTradesPerSymbol = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5000
  }

  async ensureConnected(): Promise<void> {
    await this.ensureConnections(1)
    this.ensureFlushTicker()
  }

  async syncTargetConfigs(configs: TradesConfig[]): Promise<void> {
    const targets = configs
      .filter(
        cfg => cfg.exchange.toUpperCase() === 'OKX' && cfg.instrumentType === this.instrumentType,
      )
      // 优先级越小越靠前，避免重复 instId 时高优先级配置被后者覆盖
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    const desiredInstIds = new Map<string, TradesConfig>() // instId -> cfg
    for (const cfg of targets) {
      const instId = this.resolveInstId(cfg)
      if (!instId) {
        this.logger.warn(`Trades config missing OKX instId mapping, skip: symbol=${cfg.symbol}`)
        continue
      }

      const existing = desiredInstIds.get(instId)
      if (existing) {
        // 避免同一个 instId 被多个配置静默覆盖，保留优先级更高（排在前面）的配置，其余显式告警并跳过
        this.logger.error(
          `Duplicate OKX instId mapping detected for instId=${instId}, keep first config ` +
            `(exchange=${existing.exchange}, instrumentType=${existing.instrumentType}, symbol=${existing.symbol}, ` +
            `baseAsset=${existing.baseAsset}, quoteAsset=${existing.quoteAsset}) and skip ` +
            `(exchange=${cfg.exchange}, instrumentType=${cfg.instrumentType}, symbol=${cfg.symbol}, ` +
            `baseAsset=${cfg.baseAsset}, quoteAsset=${cfg.quoteAsset})`,
        )
        continue
      }

      desiredInstIds.set(instId, cfg)
    }

    // remove stale states（在删除前先尝试 flush 缓冲，避免配置变更时丢失尚未落库的成交）
    const staleStates: TradeState[] = []
    for (const state of this.states.values()) {
      if (!desiredInstIds.has(state.instId)) {
        staleStates.push(state)
      }
    }

    if (staleStates.length) {
      const results = await Promise.allSettled(staleStates.map(state => this.flushBuffer(state)))

      let hadFlushError = false

      results.forEach((result, index) => {
        const state = staleStates[index]
        if (result.status === 'fulfilled' && result.value === true) {
          // flush 成功，安全移除该 state
          this.states.delete(state.instId)
        } else {
          hadFlushError = true
          // flush 失败：保留 state 以便后续有机会重试，避免静默丢单
          this.logger.warn(
            `Skip removing stale trades state for instId=${state.instId} due to flush failure`,
          )
        }
      })

      if (hadFlushError) {
        // 让上层管理器感知 flush 失败，从而阻止 configsHash 更新并在下次 tick 继续重试
        throw new Error('Failed to flush one or more stale trades states when syncing configs')
      }
    }

    // create new states
    for (const [instId, cfg] of desiredInstIds.entries()) {
      const state = this.states.get(instId)
      if (!state) {
        const created: TradeState = {
          cfg,
          instId,
          buffer: [],
          isReady: true,
          lastSeenTradeId: null,
          lastFlushAt: Date.now(),
        }
        this.states.set(instId, created)
      } else {
        state.cfg = cfg
      }
    }

    await this.reconcileSubscriptions([...desiredInstIds.keys()])
  }

  async shutdown(): Promise<void> {
    if (this.flushTicker) {
      clearInterval(this.flushTicker)
      this.flushTicker = null
    }

    // 先冲刷所有缓冲中的成交记录，避免进程退出时丢数据
    const states = [...this.states.values()]
    const results = await Promise.allSettled(states.map(state => this.flushBuffer(state)))

    let hadError = false

    results.forEach((result, index) => {
      const state = states[index]
      if (result.status === 'fulfilled' && result.value === true) {
        // flush 成功，可以安全移除该 state
        this.states.delete(state.instId)
      } else {
        hadError = true
        this.logger.error(
          `Failed to flush trades buffer for instId=${state.instId} during shutdown: ${
            result.status === 'rejected'
              ? result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
              : 'flushBuffer did not complete successfully'
          }`,
        )
        // 注意：此处不删除 state，保留缓冲以便上层根据异常决定后续处理策略
      }
    })

    for (const conn of this.connections) {
      conn.shutdown()
    }
    this.connections.length = 0

    if (hadError) {
      // 通过抛错让调用方感知 shutdown 期间存在未能落库的成交，避免静默丢单
      throw new Error('One or more trades buffers failed to flush during shutdown')
    }
  }

  protected streamNameForInstId(instId: string): string {
    return instId
  }

  private async ensureConnections(count: number): Promise<void> {
    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new OkxWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        msg => this.onMessage(msg),
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

  private async onMessage(msg: OkxTradesMessage): Promise<void> {
    const arg = msg.arg
    if (!arg || typeof arg.instId !== 'string') return
    if (arg.channel !== this.getWsChannel()) return

    if (!Array.isArray(msg.data) || !msg.data.length) return

    const instId = arg.instId.toUpperCase()
    const state = this.states.get(instId)
    if (!state) return

    // 添加到缓冲区，达到阈值或超时则批量插入
    for (const trade of msg.data) {
      // 避免重复插入
      if (state.lastSeenTradeId === trade.tradeId) {
        continue
      }
      state.buffer.push(trade)
      state.lastSeenTradeId = trade.tradeId
    }

    const now = Date.now()
    const BUFFER_SIZE_THRESHOLD = 100
    const FLUSH_INTERVAL_MS = 5_000 // 至少每 5 秒刷一次，防止低频成交长期堆积

    // 当缓冲区达到一定条数，或距离上次 flush 已超过阈值时，批量插入
    if (
      state.buffer.length >= BUFFER_SIZE_THRESHOLD ||
      now - state.lastFlushAt >= FLUSH_INTERVAL_MS
    ) {
      await this.flushBuffer(state)
    }
  }

  private ensureFlushTicker(): void {
    if (this.flushTicker) return

    const FLUSH_INTERVAL_MS = 5_000
    const BUFFER_SIZE_THRESHOLD = 100

    this.flushTicker = setInterval(() => {
      if (this.flushTickRunning) return
      this.flushTickRunning = true

      const now = Date.now()
      const targets: TradeState[] = []

      for (const state of this.states.values()) {
        if (state.buffer.length === 0) continue
        if (
          state.buffer.length >= BUFFER_SIZE_THRESHOLD ||
          now - state.lastFlushAt >= FLUSH_INTERVAL_MS
        ) {
          targets.push(state)
        }
      }

      void (async () => {
        if (!targets.length) return
        const results = await Promise.allSettled(targets.map(state => this.flushBuffer(state)))
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const state = targets[index]
            const reason =
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            this.logger.warn(`Flush ticker failed for instId=${state.instId}: ${reason}`)
          }
        })
      })().finally(() => {
        this.flushTickRunning = false
      })
    }, FLUSH_INTERVAL_MS)
  }

  /**
   * 批量插入缓冲区中的交易记录
   * 返回值表示本轮 flush 是否完全成功（true）或遇到错误（false）
   */
  private async flushBuffer(state: TradeState): Promise<boolean> {
    if (state.buffer.length === 0) return true

    // 串行化同一 instId 的 flush，避免并发 flush 导致 buffer 被多次 splice 而丢单
    if (state.flushPromise) {
      // 已有 flush 在进行中，直接复用该 Promise
      return state.flushPromise
    }

    state.flushPromise = (async () => {
      let hadError = false

      // 使用循环确保在一次 flush 周期内尽可能清空当前缓冲
      // 新成交写入 buffer 后，若仍满足阈值/时间条件，会在下一轮被处理
      while (state.buffer.length > 0) {
        // 拷贝当前缓冲快照，避免在写入失败时丢失尚未持久化的成交
        const trades = [...state.buffer]

        try {
          await this.batchInsertTrades(state, trades)
          // 仅在写入成功后再清空缓冲并更新时间
          state.buffer.splice(0, trades.length)
          state.lastFlushAt = Date.now()
        } catch (error) {
          hadError = true
          this.logger.error(
            `Failed to batch insert ${trades.length} trades for ${state.instId}: ${error instanceof Error ? error.message : String(error)}`,
          )
          // 写入失败时保留 buffer，等待后续 tick 或消息再次触发 flush
          break
        }
      }

      if (hadError) {
        // 显式通过 rejected promise 反馈失败，供上层决定是否删除 state
        throw new Error(`Flush buffer failed for instId=${state.instId}`)
      }

      this.trimExcessTrades(state)

      return true
    })()

    try {
      return await state.flushPromise
    } finally {
      state.flushPromise = null
    }
  }

  /**
   * 批量插入交易记录
   * 分批次插入，每批次最多 1000 条，最多 3 个并发批次
   */
  private async batchInsertTrades(state: TradeState, trades: OkxTradeData[]): Promise<void> {
    const BATCH_SIZE = 1000
    const CONCURRENT_BATCHES = 3

    for (let i = 0; i < trades.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
      const promises = []

      for (let j = 0; j < CONCURRENT_BATCHES; j++) {
        const start = i + j * BATCH_SIZE
        if (start >= trades.length) break

        const batch = trades.slice(start, Math.min(start + BATCH_SIZE, trades.length))
        const records = batch.map(trade => ({
          exchange: this.exchange,
          instrumentType: this.instrumentType,
          symbol: trade.instId,
          baseAsset: state.cfg.baseAsset,
          quoteAsset: state.cfg.quoteAsset,
          tradeId: trade.tradeId,
          price: trade.px,
          size: trade.sz,
          side: trade.side,
          tradeTimestamp: BigInt(trade.ts),
        }))

        promises.push(
          this.prismaService.marketTrade.createMany({
            data: records,
            skipDuplicates: true, // 跳过重复记录
          }),
        )
      }

      await Promise.all(promises)
    }
  }

  private resolveInstId(cfg: TradesConfig): string | null {
    const metadata = this.normalizeMetadata(cfg.metadata)
    const base = cfg.baseAsset.trim().toUpperCase()
    const quote = cfg.quoteAsset.trim().toUpperCase()

    const metaInstId = this.pickMetadataString(metadata, ['okxInstId', 'instId'])
    if (metaInstId) {
      const upper = metaInstId.trim().toUpperCase()
      if (!upper.includes('-')) return null
      const parts = upper.split('-').filter(Boolean)
      if (this.instrumentType === 'SPOT') {
        if (parts.length !== 2) return null
        return upper.endsWith('-SWAP') ? null : upper
      }
      if (this.instrumentType === 'PERPETUAL') {
        if (parts.length > 2 && !(parts.length === 3 && parts[2] === 'SWAP')) return null
        return upper.endsWith('-SWAP') ? upper : `${base}-${quote}-SWAP`
      }
      return upper
    }

    if (this.instrumentType === 'SPOT') {
      return `${base}-${quote}`
    }

    if (this.instrumentType === 'PERPETUAL') {
      return `${base}-${quote}-SWAP`
    }

    if (this.instrumentType === 'FUTURE') {
      const metaContract = this.pickMetadataString(metadata, ['okxContract'])
      if (metaContract) return metaContract.toUpperCase()
    }

    return null
  }

  private normalizeMetadata(metadata: TradesConfig['metadata']): Record<string, unknown> | null {
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

  private trimExcessTrades(state: TradeState): void {
    const key = `${this.exchange}/${this.instrumentType}/${state.instId}`
    const now = Date.now()
    const lastTrim = this.lastTrimTime.get(key) || 0

    const retries = this.retryCount.get(key) ?? 0
    const backoffMs = Math.min(this.TRIM_THROTTLE_MS * 2 ** retries, 600_000)

    if (now - lastTrim < backoffMs) return

    this.lastTrimTime.set(key, now)

    this.marketTradesRepository
      .deleteExcessTrades(this.exchange, this.instrumentType, state.instId, this.maxTradesPerSymbol)
      .then(() => {
        this.retryCount.delete(key)
      })
      .catch(err => {
        this.retryCount.set(key, retries + 1)
        this.logger.warn(
          `Failed to trim excess trades for ${key}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
      })
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
    private readonly onTradesMessage: (msg: OkxTradesMessage) => Promise<void>,
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

    logger.log(`Connecting OKX Trades WS#${this.index}: ${wsBaseUrl}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(wsBaseUrl)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`OKX Trades WS#${this.index} connected`)
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
      logger.warn(`OKX Trades WS#${this.index} closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', err => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(
        `OKX Trades WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`,
      )
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
    const intervalMs = 15_000
    const timeoutMs = 45_000

    this.heartbeatTimer = setInterval(
      () => {
        if (!this.ws) return
        const now = Date.now()
        if (now - this.lastPongTs > timeoutMs) {
          try {
            this.baseLogger.warn(`OKX Trades WS#${this.index} heartbeat timeout, terminating`)
            this.ws.terminate()
          } catch {}
          return
        }
        try {
          this.ws.send('ping')
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

  private async sendSubscription(
    op: 'subscribe' | 'unsubscribe',
    instIds: string[],
  ): Promise<void> {
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

    let msg: OkxTradesMessage
    try {
      msg = JSON.parse(text) as OkxTradesMessage
    } catch {
      return
    }

    if (msg.event === 'error') {
      this.baseLogger.warn(
        `OKX Trades WS#${this.index} error event: code=${msg.code} msg=${msg.msg}`,
      )
      return
    }
    if (msg.event === 'subscribe' || msg.event === 'unsubscribe' || msg.event === 'pong') {
      this.lastPongTs = Date.now()
      return
    }

    if (msg.arg && msg.data) {
      void this.onTradesMessage(msg).catch(err => {
        this.baseLogger.error(
          `OKX Trades WS#${this.index} onTradesMessage error: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }
  }
}
