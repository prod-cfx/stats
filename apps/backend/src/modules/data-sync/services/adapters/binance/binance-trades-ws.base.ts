/* eslint-disable perfectionist/sort-imports */

import { ErrorCode } from '@ai/shared'
import WebSocket from 'ws'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { TradesAdapterKey, TradesConfig, TradesWsAdapter } from '../../trades-ws-adapter'
import { DomainException } from '@/common/exceptions/domain.exception'
import { DataSyncOperationTimeoutException } from '@/modules/data-sync/exceptions/data-sync-operation-timeout.exception'
import { MarketTradesRepository } from '@/modules/markets/repositories/market-trades.repository'
import type { TradeEvent } from '@/modules/kline/interfaces/trade-event.interface'
import { TRADE_RECEIVED_EVENT } from '@/modules/kline/interfaces/trade-event.interface'

interface BinanceTradeEvent {
  e: 'trade'
  E: number
  s: string
  t: number
  p: string
  q: string
  b: number
  a: number
  T: number
  m: boolean
  M: boolean
}

type BinanceCombinedStreamMessage =
  | { stream: string; data: BinanceTradeEvent }
  | BinanceTradeEvent
  | { result: null; id: number }
  | { error: { code: number; msg: string }; id: number }

interface TradeState {
  cfg: TradesConfig
  symbol: string
  buffer: BinanceTradeEvent[]
  isReady: boolean
  lastSeenTradeId: string | null
  lastFlushAt: number
  flushPromise?: Promise<boolean> | null
}

@Injectable()
export abstract class BinanceTradesWsAdapterBase implements TradesWsAdapter {
  abstract readonly key: TradesAdapterKey

  protected abstract readonly exchange: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  protected abstract getWsBaseUrl(): string
  protected abstract getMaxStreamsPerConnection(): number

  private readonly logger = new Logger(this.constructor.name)
  private readonly connections: BinanceTradesWsConnection[] = []
  private readonly states = new Map<string, TradeState>() // symbol -> state
  private flushTicker: NodeJS.Timeout | null = null
  private flushTickRunning = false
  private readonly maxTradesPerSymbol: number
  private readonly lastTrimTime = new Map<string, number>()
  private readonly retryCount = new Map<string, number>()
  private readonly TRIM_THROTTLE_MS = 300_000

  constructor(
    @Inject(ConfigService)
    protected readonly configService: ConfigService,
    @Inject(EventEmitter2)
    protected readonly eventEmitter: EventEmitter2,
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
        cfg =>
          cfg.exchange.toUpperCase() === 'BINANCE' && cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    const desiredSymbols = new Map<string, TradesConfig>() // symbol -> cfg
    for (const cfg of targets) {
      const symbol = this.resolveSymbol(cfg)
      if (!symbol) {
        this.logger.warn(
          `Trades config missing Binance symbol mapping, skip: exchange=${cfg.exchange} instrumentType=${cfg.instrumentType} symbol=${cfg.symbol}`,
        )
        continue
      }

      const upper = symbol.toUpperCase()
      const existing = desiredSymbols.get(upper)
      if (existing) {
        this.logger.error(
          `Duplicate Binance symbol mapping detected for symbol=${upper}, keep first config ` +
            `(exchange=${existing.exchange}, instrumentType=${existing.instrumentType}, symbol=${existing.symbol}, ` +
            `baseAsset=${existing.baseAsset}, quoteAsset=${existing.quoteAsset}) and skip ` +
            `(exchange=${cfg.exchange}, instrumentType=${cfg.instrumentType}, symbol=${cfg.symbol}, ` +
            `baseAsset=${cfg.baseAsset}, quoteAsset=${cfg.quoteAsset})`,
        )
        continue
      }

      desiredSymbols.set(upper, cfg)
    }

    const staleStates: TradeState[] = []
    for (const state of this.states.values()) {
      if (!desiredSymbols.has(state.symbol)) {
        staleStates.push(state)
      }
    }

    if (staleStates.length) {
      const results = await Promise.allSettled(staleStates.map(state => this.flushBuffer(state)))

      let hadFlushError = false

      results.forEach((result, index) => {
        const state = staleStates[index]
        if (result.status === 'fulfilled' && result.value === true) {
          this.states.delete(state.symbol)
        } else {
          hadFlushError = true
          this.logger.warn(
            `Skip removing stale trades state for symbol=${state.symbol} due to flush failure`,
          )
        }
      })

      if (hadFlushError) {
        throw new DomainException(
          'data_sync.binance_trades_ws.flush_stale_states_failed',
          { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: 'Failed to flush one or more stale Binance trades states when syncing configs' } },
        )
      }
    }

    for (const [symbol, cfg] of desiredSymbols.entries()) {
      const state = this.states.get(symbol)
      if (!state) {
        const created: TradeState = {
          cfg,
          symbol,
          buffer: [],
          isReady: true,
          lastSeenTradeId: null,
          lastFlushAt: Date.now(),
        }
        this.states.set(symbol, created)
      } else {
        state.cfg = cfg
      }
    }

    await this.reconcileSubscriptions([...desiredSymbols.keys()])
  }

  async shutdown(): Promise<void> {
    if (this.flushTicker) {
      clearInterval(this.flushTicker)
      this.flushTicker = null
    }

    const states = [...this.states.values()]
    const results = await Promise.allSettled(states.map(state => this.flushBuffer(state)))

    let hadError = false

    results.forEach((result, index) => {
      const state = states[index]
      if (result.status === 'fulfilled' && result.value === true) {
        this.states.delete(state.symbol)
      } else {
        hadError = true
        this.logger.error(
          `Failed to flush trades buffer for symbol=${state.symbol} during shutdown: ${
            result.status === 'rejected'
              ? result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
              : 'flushBuffer did not complete successfully'
          }`,
        )
      }
    })

    for (const conn of this.connections) {
      conn.shutdown()
    }
    this.connections.length = 0

    if (hadError) {
      throw new DomainException(
        'data_sync.binance_trades_ws.shutdown_flush_failed',
        { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: 'One or more Binance trades buffers failed to flush during shutdown' } },
      )
    }
  }

  protected streamNameForSymbol(symbol: string): string {
    return `${symbol.toLowerCase()}@trade`
  }

  private async ensureConnections(count: number): Promise<void> {
    while (this.connections.length < count) {
      const idx = this.connections.length
      const conn = new BinanceTradesWsConnection(
        idx,
        this.configService,
        this.logger,
        () => this.getWsBaseUrl(),
        (msg, connection) => this.onMessage(msg, connection),
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

    const symbolSet = new Set(symbols.map(s => s.toUpperCase()))
    const streams = [...symbolSet]
      .map(s => this.streamNameForSymbol(s))
      .sort((a, b) => a.localeCompare(b))

    const chunks: string[][] = []
    for (let i = 0; i < streams.length; i += perConn) {
      chunks.push(streams.slice(i, i + perConn))
    }

    await this.ensureConnections(Math.max(1, chunks.length))

    const results = await Promise.allSettled(
      this.connections.map((conn, idx) => conn.syncDesiredStreams(new Set(chunks[idx] ?? []))),
    )

    let hadError = false

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        hadError = true
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        this.logger.error(
          `Binance trades WS connection#${index} syncDesiredStreams failed: ${reason}`,
        )
      }
    })

    if (hadError) {
      throw new DomainException(
        'data_sync.binance_trades_ws.reconcile_subscriptions_failed',
        { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: 'Failed to reconcile Binance trades WS subscriptions for one or more connections' } },
      )
    }
  }

  private async onMessage(raw: WebSocket.RawData, conn: BinanceTradesWsConnection): Promise<void> {
    let msg: BinanceCombinedStreamMessage
    try {
      msg = JSON.parse(raw.toString()) as BinanceCombinedStreamMessage
    } catch {
      return
    }

    const plain = msg as any

    // 1) 处理顶层 code/msg 错误响应（例如 { code: -1121, msg: 'Invalid symbol.', id: 1 }）
    if (typeof plain.code === 'number' && typeof plain.msg === 'string') {
      const idPart = typeof plain.id === 'number' ? ` id=${plain.id}` : ''
      const message = String(plain.msg)
      this.logger.warn(`Binance Trades WS API error: code=${plain.code} msg=${message}${idPart}`)
      conn.handleAckError(
        new DomainException(`Binance Trades WS API error: code=${plain.code} msg=${message}${idPart}`, {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { apiCode: plain.code, apiMsg: message },
        }),
      )
      return
    }

    // 2) 处理 result/error 包装的响应
    if ('result' in plain) {
      // Binance 文档：{ result: null, id } 作为订阅/退订成功的 ACK
      conn.handleAckSuccess()
      return
    }
    if ('error' in plain) {
      const err = plain.error
      this.logger.warn(`Binance Trades WS API error: code=${err?.code} msg=${err?.msg}`)
      conn.handleAckError(
        `Binance Trades WS API error: code=${err?.code ?? 'unknown'} msg=${err?.msg ?? ''}`,
      )
      return
    }

    const evt = (msg as any).data ? (msg as any).data : msg
    if (!evt || evt.e !== 'trade' || typeof evt.s !== 'string') return

    const symbol = evt.s.toUpperCase()
    const state = this.states.get(symbol)
    if (!state) return

    for (const trade of [evt]) {
      const tradeId = String(trade.t)
      if (state.lastSeenTradeId === tradeId) continue
      state.buffer.push(trade)
      state.lastSeenTradeId = tradeId

      // 发射交易事件给 K线聚合器
      try {
        // 解析并验证价格和数量
        const price = Number.parseFloat(trade.p)
        const size = Number.parseFloat(trade.q)

        // 验证数据有效性，过滤无效数据
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0) {
          this.logger.debug({
            message: 'Invalid Binance trade data, skipping event emission',
            symbol: trade.s,
            rawPrice: trade.p,
            rawSize: trade.q,
            parsedPrice: price,
            parsedSize: size,
            tradeId,
          })
          continue
        }

        const tradeEvent: TradeEvent = {
          exchange: this.exchange,
          instrumentType: this.instrumentType,
          symbol: trade.s.toUpperCase(),
          price,
          size,
          side: trade.m ? 'sell' : 'buy',
          timestamp: trade.T,
        }
        this.eventEmitter.emit(TRADE_RECEIVED_EVENT, tradeEvent)
      } catch (error) {
        // 事件发射失败不应影响数据入库,仅记录日志
        this.logger.warn({
          message: 'Failed to emit trade event',
          symbol: trade.s,
          tradeId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const now = Date.now()
    const BUFFER_SIZE_THRESHOLD = 100
    const FLUSH_INTERVAL_MS = 5_000

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
            this.logger.warn(
              `Binance trades flush ticker failed for symbol=${state.symbol}: ${reason}`,
            )
          }
        })
      })().finally(() => {
        this.flushTickRunning = false
      })
    }, FLUSH_INTERVAL_MS)
  }

  private async flushBuffer(state: TradeState): Promise<boolean> {
    if (state.buffer.length === 0) return true

    if (state.flushPromise) {
      return state.flushPromise
    }

    state.flushPromise = (async () => {
      let hadError = false

      while (state.buffer.length > 0) {
        const trades = [...state.buffer]

        try {
          await this.batchInsertTrades(state, trades)
          state.buffer.splice(0, trades.length)
          state.lastFlushAt = Date.now()
        } catch (error) {
          hadError = true
          this.logger.error(
            `Failed to batch insert ${trades.length} Binance trades for ${state.symbol}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
          break
        }
      }

      if (hadError) {
        throw new DomainException(
          'data_sync.binance_trades_ws.flush_buffer_failed',
          { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: `Flush buffer failed for symbol=${state.symbol}` } },
        )
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

  private async batchInsertTrades(state: TradeState, trades: BinanceTradeEvent[]): Promise<void> {
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
          symbol: trade.s.toUpperCase(),
          baseAsset: state.cfg.baseAsset,
          quoteAsset: state.cfg.quoteAsset,
          tradeId: String(trade.t),
          price: trade.p,
          size: trade.q,
          side: trade.m ? 'sell' : 'buy',
          tradeTimestamp: BigInt(trade.T),
        }))

        promises.push(
          this.marketTradesRepository.createManyTrades(records),
        )
      }

      await Promise.all(promises)
    }
  }

  private resolveSymbol(cfg: TradesConfig): string | null {
    const base = cfg.baseAsset.trim().toUpperCase()
    const quote = cfg.quoteAsset.trim().toUpperCase()

    // 优先使用配置自身的 symbol 字段（admin 后台已约定该字段保存交易所原生合约 ID）
    const rawSymbol = typeof cfg.symbol === 'string' ? cfg.symbol.trim().toUpperCase() : ''
    if (rawSymbol.length) {
      return rawSymbol
    }

    const metadata = this.normalizeMetadata(cfg.metadata)
    const metaSymbol = this.pickMetadataString(metadata, ['binanceSymbol', 'symbol'])
    if (metaSymbol) {
      const upper = metaSymbol.trim().toUpperCase()
      if (!upper.length) return null
      return upper
    }

    // 默认使用 BASE+QUOTE（例如 BTCUSDT）
    if (!base.length || !quote.length) return null
    return `${base}${quote}`
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
    const key = `${this.exchange}/${this.instrumentType}/${state.symbol}`
    const now = Date.now()
    const lastTrim = this.lastTrimTime.get(key) || 0

    const retries = this.retryCount.get(key) ?? 0
    const backoffMs = Math.min(this.TRIM_THROTTLE_MS * 2 ** retries, 600_000)

    if (now - lastTrim < backoffMs) return

    this.lastTrimTime.set(key, now)

    this.marketTradesRepository
      .deleteExcessTrades(this.exchange, this.instrumentType, state.symbol, this.maxTradesPerSymbol)
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

class BinanceTradesWsConnection {
  private ws: WebSocket | null = null
  private open = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTs = 0
  private requestId = 1

  private desired = new Set<string>()
  private active = new Set<string>()
  /**
   * 当前订阅/退订同步过程的 pending promise。
   * 当收到 Binance 的错误响应（code/msg 或 error）或在超时时间内未收到成功 ACK 时会触发 reject，
   * 使得 syncDesiredStreams 失败并让上层感知订阅未成功。
   */
  private pendingSync: {
    promise: Promise<void>
    resolve: () => void
    reject: (err: Error) => void
    remainingAcks: number
  } | null = null

  constructor(
    private readonly index: number,
    private readonly configService: ConfigService,
    private readonly baseLogger: Logger,
    private readonly getWsBaseUrl: () => string,
    private readonly onTradesMessage: (
      raw: WebSocket.RawData,
      conn: BinanceTradesWsConnection,
    ) => Promise<void>,
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

    // 若本轮确实有订阅/退订操作，则等待 Binance 的 ACK 结果
    const expectedAcks = (toSub.length ? 1 : 0) + (toUnsub.length ? 1 : 0)
    if (expectedAcks > 0) {
      this.pendingSync = this.createPendingSync(expectedAcks)
      try {
        await this.pendingSync.promise
      } finally {
        this.pendingSync = null
      }
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

    logger.log(`Connecting Binance Trades WS#${this.index}: ${url}`)

    this.open = false
    this.active.clear()
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      logger.log(`Binance Trades WS#${this.index} connected`)
      this.startHeartbeat()
      void this.resyncOnOpen()
    })

    this.ws.on('message', data => {
      void this.onTradesMessage(data, this).catch(err => {
        const reason = err instanceof Error ? err.message : String(err)

        // 如果当前存在正在进行的订阅同步，则将其视为本轮 SUB/UNSUB 失败
        if (this.pendingSync) {
          const pending = this.pendingSync
          this.pendingSync = null
          // 当前连接的订阅状态已不可信，清空本地 active/desired，交由上层重建
          this.active.clear()
          this.desired.clear()
          pending.reject(err instanceof Error ? err : new DomainException(reason, {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason },
          }))
          return
        }

        // 否则视为运行期处理 trades 时的异常，仅记录日志以便排查
        this.baseLogger.error(`Binance Trades WS#${this.index} onTradesMessage error: ${reason}`)
      })
    })

    this.ws.on('pong', () => {
      this.lastPongTs = Date.now()
    })

    this.ws.on('close', (code, reason) => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.warn(
        `Binance Trades WS#${this.index} closed: code=${code} reason=${reason.toString()}`,
      )
      this.scheduleReconnect()
    })

    this.ws.on('error', err => {
      this.open = false
      this.active.clear()
      this.stopHeartbeat()
      logger.error(
        `Binance Trades WS#${this.index} error: ${err instanceof Error ? err.message : String(err)}`,
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
    const intervalMs = this.configService.get<number>('TRADES_WS_HEARTBEAT_INTERVAL_MS') ?? 15_000
    const timeoutMs = this.configService.get<number>('TRADES_WS_HEARTBEAT_TIMEOUT_MS') ?? 45_000

    this.heartbeatTimer = setInterval(
      () => {
        if (!this.ws) return
        const now = Date.now()
        if (now - this.lastPongTs > timeoutMs) {
          try {
            this.baseLogger.warn(`Binance Trades WS#${this.index} heartbeat timeout, terminating`)
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

  handleAckSuccess(): void {
    if (!this.pendingSync) return
    if (this.pendingSync.remainingAcks <= 0) return
    this.pendingSync.remainingAcks -= 1
    if (this.pendingSync.remainingAcks === 0) {
      this.pendingSync.resolve()
    }
  }

  handleAckError(error: Error | string): void {
    if (!this.pendingSync) return
    const pending = this.pendingSync
    this.pendingSync = null
    this.active.clear()
    this.desired.clear()
    pending.reject(error instanceof Error ? error : new DomainException(error, {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { error },
    }))
  }

  private createPendingSync(expectedAcks: number): {
    promise: Promise<void>
    resolve: () => void
    reject: (err: Error) => void
    remainingAcks: number
  } {
    let resolve!: () => void
    let reject!: (err: Error) => void

    const timeoutMs = this.configService.get<number>('TRADES_WS_SUBSCRIBE_TIMEOUT_MS') ?? 5_000

    let timeout: NodeJS.Timeout | null = null

    const promise = new Promise<void>((res, rej) => {
      resolve = () => {
        if (timeout) clearTimeout(timeout)
        res()
      }
      reject = (err: Error) => {
        if (timeout) clearTimeout(timeout)
        rej(err)
      }
    })

    timeout = setTimeout(
      () => {
        this.baseLogger.warn(
          `Binance Trades WS#${this.index} syncDesiredStreams timeout after ${timeoutMs}ms without receiving all ACKs`,
        )
        reject(
          new DataSyncOperationTimeoutException({
            operation: `binance-trades-ws#${this.index}-sync`,
            timeoutMs,
          }),
        )
      },
      Math.max(1_000, timeoutMs),
    )

    return { promise, resolve, reject, remainingAcks: expectedAcks }
  }
}
