import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import type { OrderbookPairConfig } from '@prisma/client'
import WebSocket from 'ws'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis } from 'ioredis'
import { inspect } from 'node:util'
import type { OrderbookAdapterKey, OrderbookWsAdapter } from '../../orderbook-ws-adapter'
import { RedisService } from '@/common/services/redis.service'

/**
 * Hyperliquid WsLevel 结构
 */
interface HyperliquidWsLevel {
  px: string // price
  sz: string // size
  n: number // number of orders
}

/**
 * Hyperliquid WsBook 响应结构
 */
interface HyperliquidWsBook {
  coin: string
  levels: [HyperliquidWsLevel[], HyperliquidWsLevel[]] // [bids, asks]
  time: number
}

/**
 * Hyperliquid WebSocket 消息类型
 */
type HyperliquidWsMessage =
  | { channel: 'l2Book'; data: HyperliquidWsBook }
  | { channel: 'subscriptionResponse'; data: { method: string; subscription: { type: string; coin: string } } }
  | { channel: 'error'; data: { message: string } }

interface BookState {
  cfg: OrderbookPairConfig
  marketKey: string
  lastPublishTs: number
  version: number
}

/**
 * Hyperliquid 订单薄 WS 同步通用基类：
 * - 单连接管理（Hyperliquid 限制 100 连接/1000 订阅，足够使用单连接）
 * - 心跳 + 超时重连
 * - 纯 snapshot 模式（Hyperliquid 每 ~0.5s 推送完整快照）
 * - 写入 Redis（VenueOrderBook）
 */
@Injectable()
export abstract class HyperliquidOrderbookWsAdapterBase implements OrderbookWsAdapter {
  abstract readonly key: OrderbookAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL'

  private readonly logger = new Logger(this.constructor.name)
  private ws: WebSocket | null = null
  private open = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTs = 0
  private missedPongCount = 0 // 连续 ping 失败计数
  private readonly states = new Map<string, BookState>() // coin -> state
  private readonly pendingRemoval = new Set<string>() // coins pending removal
  private readonly subscribedCoins = new Set<string>()
  private redis: Redis | null = null

  constructor(
    @Inject(ConfigService)
    protected readonly configService: ConfigService,
    @Inject(RedisService)
    protected readonly redisService: RedisService,
  ) {}

  async ensureConnected(): Promise<void> {
    if (this.open && this.ws) return
    await this.connect()
  }

  async syncTargetConfigs(configs: OrderbookPairConfig[]): Promise<void> {
    // 检查 Hyperliquid 专用开关
    if (!this.isHyperliquidEnabled()) {
      // 如果禁用，清理所有现有订阅（两阶段删除：标记 → 处理 → 删除）
      const coinsToRemove = [...this.states.keys()]
      for (const coin of coinsToRemove) {
        this.pendingRemoval.add(coin)
      }
      // 并行处理退订和删除
      await Promise.allSettled(
        coinsToRemove.map(async (coin) => {
          const state = this.states.get(coin)
          await this.unsubscribe(coin)
          await this.deleteRedisSnapshot(coin, state)
          this.states.delete(coin)
          this.pendingRemoval.delete(coin)
        }),
      )
      return
    }

    const targets = configs
      .filter(cfg =>
        cfg.venue.toUpperCase() === 'HYPERLIQUID'
        && cfg.venueType === 'DEX'
        && cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => a.priority - b.priority)

    const targetCoins = new Map<string, OrderbookPairConfig>()
    for (const cfg of targets) {
      const coin = this.toCoin(cfg)
      targetCoins.set(coin, cfg)
    }

    // 移除的 coin：两阶段删除（标记 → 处理 → 删除）避免竞态
    const coinsToRemove = [...this.states.keys()].filter(coin => !targetCoins.has(coin))
    for (const coin of coinsToRemove) {
      this.pendingRemoval.add(coin)
    }
    // 并行处理退订和删除
    await Promise.allSettled(
      coinsToRemove.map(async (coin) => {
        const state = this.states.get(coin)
        await this.unsubscribe(coin)
        await this.deleteRedisSnapshot(coin, state)
        this.states.delete(coin)
        this.pendingRemoval.delete(coin)
      }),
    )

    // 新增或更新
    const coinsToSubscribe: string[] = []
    for (const [coin, cfg] of targetCoins.entries()) {
      const state = this.states.get(coin)
      if (!state) {
        const created: BookState = {
          cfg,
          marketKey: toMarketKey(this.toMarketIdFromConfig(cfg)),
          lastPublishTs: 0,
          version: 0,
        }
        this.states.set(coin, created)
        coinsToSubscribe.push(coin)
      }
      else {
        state.cfg = cfg
      }
    }
    // 并行订阅所有新增的 coin
    await Promise.allSettled(coinsToSubscribe.map(coin => this.subscribe(coin)))
  }

  async shutdown(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    this.open = false
    this.subscribedCoins.clear()
    this.states.clear()
    this.pendingRemoval.clear()
    if (this.ws) {
      try {
        this.ws.close()
      }
      catch (err) {
        this.logger.debug(`WS close failed during shutdown: ${inspect(err, { depth: 2 })}`)
      }
      this.ws = null
    }
    this.redis = null
  }

  /**
   * 将配置转换为 Hyperliquid coin 格式
   * - 永续合约：直接使用 baseAsset（如 BTC, ETH）
   * - 现货：使用 baseAsset/quoteAsset 格式（如 PURR/USDC）或 @index 格式
   */
  protected abstract toCoin(cfg: OrderbookPairConfig): string

  protected getWsUrl(): string {
    return this.configService.get<string>('HYPERLIQUID_WS_URL') ?? 'wss://api.hyperliquid.xyz/ws'
  }

  private async connect(): Promise<void> {
    if (this.ws && (this.open || this.ws.readyState === WebSocket.CONNECTING)) return

    if (!this.redis) this.redis = this.redisService.getClient()

    const url = this.getWsUrl()
    this.logger.log(`Connecting Hyperliquid WS: ${url}`)

    this.open = false
    this.subscribedCoins.clear()
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      this.logger.log('Hyperliquid WS connected')
      this.startHeartbeat()
      void this.resubscribeAll()
    })

    this.ws.on('message', (data: WebSocket.RawData) => {
      void this.onMessage(data)
    })

    this.ws.on('pong', () => {
      this.lastPongTs = Date.now()
      this.missedPongCount = 0 // 重置失败计数
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.open = false
      this.subscribedCoins.clear()
      this.stopHeartbeat()
      this.logger.warn(`Hyperliquid WS closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', (err: Error) => {
      this.open = false
      this.subscribedCoins.clear()
      this.stopHeartbeat()
      this.logger.error(`Hyperliquid WS error: ${err instanceof Error ? err.message : String(err)}`)
      this.scheduleReconnect()
    })
  }

  private async resubscribeAll(): Promise<void> {
    if (!this.open || !this.ws) return
    await Promise.allSettled([...this.states.keys()].map(coin => this.subscribe(coin)))
  }

  private async subscribe(coin: string): Promise<void> {
    if (!this.open || !this.ws || this.subscribedCoins.has(coin)) return

    const state = this.states.get(coin)
    const nLevels = state?.cfg.depthLevels ?? 100

    const msg = {
      method: 'subscribe',
      subscription: {
        type: 'l2Book',
        coin,
        nSigFigs: 5,
        ...(nLevels > 0 ? { nLevels: Math.min(nLevels, 100) } : {}),
      },
    }

    try {
      this.ws.send(JSON.stringify(msg))
      this.subscribedCoins.add(coin)
      this.logger.debug(`Subscribed to ${coin} l2Book`)
    }
    catch (err) {
      this.logger.error(`Failed to subscribe ${coin}: ${inspect(err, { depth: 2 })}`)
    }
  }

  private async unsubscribe(coin: string): Promise<void> {
    if (!this.open || !this.ws || !this.subscribedCoins.has(coin)) return

    const msg = {
      method: 'unsubscribe',
      subscription: {
        type: 'l2Book',
        coin,
      },
    }

    try {
      this.ws.send(JSON.stringify(msg))
      this.subscribedCoins.delete(coin)
      this.logger.debug(`Unsubscribed from ${coin} l2Book`)
    }
    catch (err) {
      this.logger.error(`Failed to unsubscribe ${coin}: ${inspect(err, { depth: 2 })}`)
    }
  }

  private async onMessage(raw: WebSocket.RawData): Promise<void> {
    let msg: HyperliquidWsMessage
    try {
      msg = JSON.parse(raw.toString()) as HyperliquidWsMessage
    }
    catch (err) {
      const rawStr = raw.toString()
      this.logger.debug(`JSON parse failed: ${inspect(err, { depth: 1 })}, raw=${rawStr.slice(0, 200)}`)
      return
    }

    if (msg.channel === 'error') {
      this.logger.warn(`Hyperliquid WS error: ${msg.data.message}`)
      return
    }

    if (msg.channel === 'subscriptionResponse') {
      this.logger.debug(`Subscription response: ${msg.data.method} ${msg.data.subscription.coin}`)
      return
    }

    if (msg.channel === 'l2Book') {
      await this.handleL2Book(msg.data)
    }
  }

  private async handleL2Book(book: HyperliquidWsBook): Promise<void> {
    const coin = book.coin
    const state = this.states.get(coin)
    if (!state) return

    const publishIntervalMs = this.configService.get<number>('ORDERBOOK_WS_PUBLISH_INTERVAL_MS') ?? 250
    const now = Date.now()

    // 限流：避免过于频繁写入 Redis
    if (now - state.lastPublishTs < publishIntervalMs) {
      return
    }

    state.lastPublishTs = now
    state.version += 1

    await this.publish(state, book)
  }

  private async publish(state: BookState, book: HyperliquidWsBook): Promise<void> {
    if (!this.redis) return

    const depthLevels = state.cfg.depthLevels ?? 100
    const [rawBids, rawAsks] = book.levels

    const bids = this.convertLevels(rawBids, depthLevels)
    const asks = this.convertLevels(rawAsks, depthLevels)

    const venueBook: VenueOrderBook = {
      venueId: this.venueId,
      marketKey: state.marketKey,
      bids,
      asks,
      exchangeTs: book.time,
      receivedTs: Date.now(),
      version: state.version,
    }

    const redisKey = this.buildRedisKey(venueBook.venueId, venueBook.marketKey)
    await this.redis.set(redisKey, JSON.stringify(venueBook))
  }

  private convertLevels(
    levels: HyperliquidWsLevel[],
    maxLevels: number,
  ): { price: number; size: number }[] {
    const result: { price: number; size: number }[] = []
    // 价格合理范围：0 < price <= 1e12（覆盖所有加密货币和现货资产）
    const MAX_PRICE = 1e12

    for (const level of levels) {
      if (result.length >= maxLevels) break

      const price = Number(level.px)
      const size = Number(level.sz)

      // 跳过无效值：非有限数、非正价格、超出范围价格、非正数量
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue
      if (price <= 0 || price > MAX_PRICE || size <= 0) continue

      result.push({ price, size })
    }

    return result
  }

  private buildRedisKey(venueId: string, marketKey: string): string {
    return `orderbook:${venueId}:${marketKey}`
  }

  private async deleteRedisSnapshot(coin: string, state?: BookState): Promise<void> {
    if (!this.redis || !state) return
    const redisKey = this.buildRedisKey(this.venueId, state.marketKey)
    try {
      await this.redis.del(redisKey)
      this.logger.log(`Orderbook snapshot deleted: coin=${coin}, key=${redisKey}`)
    }
    catch (error) {
      this.logger.warn(
        `Failed to delete orderbook snapshot for ${coin}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
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
    // 防止重复启动
    if (this.heartbeatTimer) return
    // 缩短心跳间隔和超时时间以加快断连检测
    const intervalMs = this.configService.get<number>('ORDERBOOK_WS_HEARTBEAT_INTERVAL_MS') ?? 5_000
    const maxMissedPongs = this.configService.get<number>('ORDERBOOK_WS_MAX_MISSED_PONGS') ?? 3

    this.missedPongCount = 0
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws) return
      const now = Date.now()
      // 检查上次 pong 是否超过一个心跳周期
      if (now - this.lastPongTs > intervalMs * 1.5) {
        this.missedPongCount++
        this.logger.debug(`Missed pong #${this.missedPongCount}, last pong ${now - this.lastPongTs}ms ago`)
      }
      // 连续失败超过阈值则重连
      if (this.missedPongCount >= maxMissedPongs) {
        try {
          this.logger.warn(`Hyperliquid WS heartbeat: ${this.missedPongCount} consecutive missed pongs, terminating`)
          this.ws.terminate()
        }
        catch (err) {
          this.logger.debug(`WS terminate failed: ${inspect(err, { depth: 1 })}`)
        }
        return
      }
      try {
        this.ws.ping()
      }
      catch (err) {
        this.logger.debug(`WS ping failed: ${inspect(err, { depth: 1 })}`)
      }
    }, Math.max(3_000, intervalMs))
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private toMarketIdFromConfig(cfg: Pick<OrderbookPairConfig, 'baseAsset' | 'quoteAsset' | 'instrumentType'>): MarketId {
    const base = cfg.baseAsset.toUpperCase()
    const quote = cfg.quoteAsset.toUpperCase()
    const venueType: MarketId['venueType'] = cfg.instrumentType === 'SPOT' ? 'spot' : 'perp'
    return { base, quote, venueType }
  }

  /**
   * 检查 Hyperliquid orderbook WS 是否启用
   * 使用独立的环境变量 HYPERLIQUID_ORDERBOOK_WS_ENABLED
   */
  private isHyperliquidEnabled(): boolean {
    const raw = this.configService.get<string>('HYPERLIQUID_ORDERBOOK_WS_ENABLED')
    if (typeof raw === 'string') {
      return raw.toLowerCase() === 'true'
    }
    return Boolean(raw)
  }
}
