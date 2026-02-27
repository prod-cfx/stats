import type { OrderBookLevel, VenueOrderBook } from '@ai/shared'
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'
import type { MarketTrade } from '@prisma/client'
import type { Server, Socket } from 'socket.io'
import type { KlineBarDto } from './dto/kline-bar.dto'
import type { KlineSubscriptionDto } from './dto/kline-subscription.dto'
import type { OrderbookSubscriptionDto } from './dto/orderbook-subscription.dto'
import type { TickerBroadcastDto } from './dto/ticker-broadcast.dto'
import type { TickerSubscriptionDto } from './dto/ticker-subscription.dto'
import type { TradesSubscriptionDto } from './dto/trades-subscription.dto'

import { Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { JwtService } from '@nestjs/jwt'
import { Interval } from '@nestjs/schedule'
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'

// eslint-disable-next-line ts/consistent-type-imports
import { CacheService } from '@/common/services/cache.service'
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
// eslint-disable-next-line ts/consistent-type-imports
import { AggregatedOrderbookService } from '../aggregated-orderbook/aggregated-orderbook.service'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketsService } from '../markets/markets.service'
// eslint-disable-next-line ts/consistent-type-imports
import { KlineAggregatorService } from './kline-aggregator.service'

// 单个客户端最大订阅数限制
const MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT = 20
const MAX_KLINE_SUBSCRIPTIONS_PER_CLIENT = 10
const MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT = 10
const MAX_ORDERBOOK_SUBSCRIPTIONS_PER_CLIENT = 10
const MAX_TICKER_SUBSCRIPTIONS_PER_CLIENT = 10
const SOCKET_PING_INTERVAL_MS = 25000
const SOCKET_PING_TIMEOUT_MS = 5000
const STALE_CONNECTION_THRESHOLD_MS = 120000

// 允许的 CORS origin 正则模式
const ALLOWED_ORIGIN_PATTERNS = [
  ...(process.env.NODE_ENV === 'development'
    ? [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]
    : []),
  /^https:\/\/(www|app|admin)\.coinflux\.com$/,
]

/**
 * 验证 CORS origin 是否合法
 */
function isValidOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false
  }
  // 检查是否为有效 URL 格式
  try {
    const url = new URL(origin)
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return false
    }
  } catch {
    return false
  }
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin))
}

/**
 * 解析并验证 ALLOWED_ORIGINS 环境变量
 */
function parseAllowedOrigins(): string[] {
  const envOrigins =
    process.env.ALLOWED_ORIGINS?.split(',')
      .map(o => o.trim())
      .filter(Boolean) || []
  const validOrigins = envOrigins.filter(isValidOrigin)

  // 如果没有有效的 origin，使用默认值
  if (validOrigins.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      return ['http://localhost:3001']
    }
    return ['https://app.coinflux.com']
  }
  return validOrigins
}

// Trades 订阅信息接口
interface TradesSubscriptionInfo {
  timer: NodeJS.Timeout
  clients: Set<string>
  roomName: string // Socket.IO room 名称
  isRunning: boolean // 防止任务堆积的标志
  params: {
    exchange: string
    instrumentType: string
    symbol: string
    minValue?: number
    limit: number
  }
}

// Order Book 订阅信息接口
interface OrderbookSubscriptionInfo {
  timer: NodeJS.Timeout
  clients: Set<string>
  roomName: string // Socket.IO room 名称
  isRunning: boolean // 防止任务堆积的标志
  params: {
    exchange: string
    instrumentType: string
    symbol: string
    isAggregated: boolean
    depth: number
  }
}

// Ticker 订阅信息接口
interface TickerSubscriptionInfo {
  timer: NodeJS.Timeout
  clients: Set<string>
  roomName: string
  isRunning: boolean
  lastKlinePrice: number | null // 最新 K线价格（来自 KlineAggregatorService）
  klineCallback: (bar: KlineBarDto) => void // K线回调函数
  params: {
    exchange: string
    instrumentType: string
    symbol: string // 基础币种，例如 'BTC'
    quoteAsset: string
  }
}

type AggregatedOrderbookResult = Awaited<
  ReturnType<AggregatedOrderbookService['getAggregatedOrderbook']>
>

interface VenueOrderbookSnapshot {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  venueId: string
  marketKey: string
  updatedAt: number
}

type OrderbookPayload = AggregatedOrderbookResult | VenueOrderbookSnapshot

@WebSocketGateway({
  cors: {
    origin: parseAllowedOrigins(),
    credentials: true,
  },
  namespace: '/kline',
  pingInterval: SOCKET_PING_INTERVAL_MS,
  pingTimeout: SOCKET_PING_TIMEOUT_MS,
})
export class KlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(KlineGateway.name)

  // 客户端订阅管理：clientId -> Set<subscriptionKey>
  private readonly clientSubscriptions = new Map<string, Set<string>>()

  // 客户端回调函数管理：clientId:subscriptionKey -> callback
  private readonly clientCallbacks = new Map<string, (bar: KlineBarDto) => void>()

  // Trades 订阅管理：clientId -> Set<tradesSubscriptionKey>
  private readonly clientTradesSubscriptions = new Map<string, Set<string>>()

  // Trades 定时器管理：tradesSubscriptionKey -> TradesSubscriptionInfo
  private readonly tradesIntervals = new Map<string, TradesSubscriptionInfo>()

  // Order Book 订阅管理：clientId -> Set<orderbookSubscriptionKey>
  private readonly clientOrderbookSubscriptions = new Map<string, Set<string>>()

  // Order Book 定时器管理：orderbookSubscriptionKey -> OrderbookSubscriptionInfo
  private readonly orderbookIntervals = new Map<string, OrderbookSubscriptionInfo>()

  // Ticker 订阅管理：clientId -> Set<tickerSubscriptionKey>
  private readonly clientTickerSubscriptions = new Map<string, Set<string>>()

  // Ticker 定时器管理：tickerSubscriptionKey -> TickerSubscriptionInfo
  private readonly tickerIntervals = new Map<string, TickerSubscriptionInfo>()

  // Ticker 数据库查询缓存：symbol -> { data, timestamp }
  private readonly tickerDbCache = new Map<
    string,
    {
      data: Awaited<ReturnType<MarketsService['getTicker']>>
      timestamp: number
    }
  >()

  private readonly TICKER_DB_CACHE_TTL_MS = 1000

  constructor(
    private readonly klineAggregatorService: KlineAggregatorService,
    private readonly jwtService: JwtService,
    private readonly marketsService: MarketsService,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
    private readonly aggregatedOrderbookService: AggregatedOrderbookService,
  ) {}

  handleConnection(client: Socket): void {
    this.updateClientActivity(client)

    // 从握手中获取 token (支持 query 和 headers 两种方式)
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '')

    // 支持游客模式：没有 token 或 token 无效时，允许连接但标记为游客
    if (!token) {
      this.logger.log({
        message: 'Guest client connected (no token)',
        clientId: client.id,
      })
      client.data.isGuest = true
      this.clientSubscriptions.set(client.id, new Set())
      return
    }

    // 尝试验证 JWT token
    try {
      const payload = this.jwtService.verify(token)

      // 将用户信息附加到 socket 对象上,供后续使用
      client.data.userId = payload.sub || payload.userId
      client.data.username = payload.username
      client.data.isGuest = false

      this.logger.log({
        message: 'Authenticated client connected',
        clientId: client.id,
        userId: client.data.userId,
      })
      this.clientSubscriptions.set(client.id, new Set())
    } catch (error) {
      // Token 无效时，降级为游客模式
      this.logger.warn({
        message: 'Invalid token, connecting as guest',
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
      })
      client.data.isGuest = true
      this.clientSubscriptions.set(client.id, new Set())
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log({
      message: 'Client disconnected',
      clientId: client.id,
    })

    // 清理该客户端的所有 K线订阅
    const subscriptions = this.clientSubscriptions.get(client.id)
    if (subscriptions) {
      for (const key of subscriptions) {
        // 解析 subscriptionKey: BINANCE:PERPETUAL:BTCUSDT:1m
        const parts = key.split(':')
        if (parts.length === 4) {
          const [exchange, instrumentType, symbol, interval] = parts
          const callbackKey = `${client.id}:${key}`
          const callback = this.clientCallbacks.get(callbackKey)
          if (callback) {
            this.klineAggregatorService.unsubscribe(
              exchange,
              instrumentType,
              symbol,
              interval,
              callback,
            )
            this.clientCallbacks.delete(callbackKey)
          }
        }
      }
      this.clientSubscriptions.delete(client.id)
    }

    // 清理该客户端的所有 Trades 订阅
    const tradesSubscriptions = this.clientTradesSubscriptions.get(client.id)
    if (tradesSubscriptions) {
      for (const key of tradesSubscriptions) {
        this.removeClientFromTradesSubscription(client.id, key)
      }
      this.clientTradesSubscriptions.delete(client.id)
    }

    // 清理该客户端的所有 Order Book 订阅
    const orderbookSubs = this.clientOrderbookSubscriptions.get(client.id)
    if (orderbookSubs) {
      for (const key of orderbookSubs) {
        const subInfo = this.orderbookIntervals.get(key)
        if (subInfo) {
          subInfo.clients.delete(client.id)
          if (subInfo.clients.size === 0) {
            clearTimeout(subInfo.timer)
            this.orderbookIntervals.delete(key)
          }
        }
      }
      this.clientOrderbookSubscriptions.delete(client.id)
    }

    // 清理该客户端的所有 Ticker 订阅
    const tickerSubs = this.clientTickerSubscriptions.get(client.id)
    if (tickerSubs) {
      for (const key of tickerSubs) {
        this.removeClientFromTickerSubscription(client.id, key)
      }
      this.clientTickerSubscriptions.delete(client.id)
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: KlineSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.updateClientActivity(client)
    const { symbol, interval } = data

    // 默认使用 BINANCE PERPETUAL (可以从配置或请求参数获取)
    const exchange = 'BINANCE'
    const instrumentType = 'PERPETUAL'

    const subscriptionKey = this.getSubscriptionKey(exchange, instrumentType, symbol, interval)

    this.logger.log({
      message: 'Client subscribing to aggregated kline',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      interval,
      subscriptionKey,
    })

    const clientSubs = this.clientSubscriptions.get(client.id) ?? new Set<string>()
    if (!this.clientSubscriptions.has(client.id)) {
      this.clientSubscriptions.set(client.id, clientSubs)
    }

    const isNewSubscription = !clientSubs.has(subscriptionKey)
    const tradesSubs = this.clientTradesSubscriptions.get(client.id)?.size ?? 0

    // 检查总订阅数
    if (isNewSubscription && clientSubs.size + tradesSubs >= MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum total subscriptions (${MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_SUBSCRIPTIONS_EXCEEDED',
      })
      this.logger.warn({
        message: 'Client exceeded total subscription limit',
        clientId: client.id,
        klineSubs: clientSubs.size,
        tradesSubs,
        limit: MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    // 检查 Kline 订阅数
    if (isNewSubscription && clientSubs.size >= MAX_KLINE_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum kline subscriptions (${MAX_KLINE_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_KLINE_SUBSCRIPTIONS_EXCEEDED',
      })
      this.logger.warn({
        message: 'Client exceeded kline subscription limit',
        clientId: client.id,
        klineSubs: clientSubs.size,
        limit: MAX_KLINE_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    // 记录客户端订阅
    clientSubs.add(subscriptionKey)

    // 创建回调函数
    const callback = (bar: KlineBarDto) => {
      // 广播给该客户端
      client.emit('kline', {
        symbol,
        interval,
        bar,
      })
    }

    // 保存回调函数
    const callbackKey = `${client.id}:${subscriptionKey}`
    const existingCallback = this.clientCallbacks.get(callbackKey)
    if (existingCallback) {
      this.logger.warn({
        message: 'Duplicate subscription detected, replacing existing callback',
        clientId: client.id,
        subscriptionKey,
        exchange,
        instrumentType,
        symbol,
        interval,
      })

      this.klineAggregatorService.unsubscribe(
        exchange,
        instrumentType,
        symbol,
        interval,
        existingCallback,
      )
    }
    this.clientCallbacks.set(callbackKey, callback)

    // 订阅聚合 K线
    this.klineAggregatorService.subscribe(exchange, instrumentType, symbol, interval, callback)

    // 发送订阅成功确认
    client.emit('subscribed', {
      symbol,
      interval,
      subscriptionKey,
    })
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: KlineSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.updateClientActivity(client)
    const { symbol, interval } = data

    // 默认使用 BINANCE PERPETUAL
    const exchange = 'BINANCE'
    const instrumentType = 'PERPETUAL'

    const subscriptionKey = this.getSubscriptionKey(exchange, instrumentType, symbol, interval)

    this.logger.log({
      message: 'Client unsubscribing from aggregated kline',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      interval,
      subscriptionKey,
    })

    // 移除客户端订阅记录
    const clientSubs = this.clientSubscriptions.get(client.id)
    if (clientSubs) {
      clientSubs.delete(subscriptionKey)
    }

    // 获取回调函数并取消订阅
    const callbackKey = `${client.id}:${subscriptionKey}`
    const callback = this.clientCallbacks.get(callbackKey)
    if (callback) {
      this.klineAggregatorService.unsubscribe(exchange, instrumentType, symbol, interval, callback)
      this.clientCallbacks.delete(callbackKey)
    }

    // 发送取消订阅确认
    client.emit('unsubscribed', {
      symbol,
      interval,
      subscriptionKey,
    })
  }

  private getSubscriptionKey(
    exchange: string,
    instrumentType: string,
    symbol: string,
    interval: string,
  ): string {
    return `${exchange}:${instrumentType}:${symbol.toUpperCase()}:${interval}`
  }

  @SubscribeMessage('subscribeTrades')
  async handleSubscribeTrades(
    @MessageBody() data: TradesSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.updateClientActivity(client)
    const { exchange, instrumentType, symbol, minValue, limit = 50 } = data

    const subscriptionKey = this.getTradesSubscriptionKey(
      exchange,
      instrumentType,
      symbol,
      minValue,
    )

    // 任务1: 速率限制 - 检查客户端当前订阅数
    let clientSubs = this.clientTradesSubscriptions.get(client.id)
    if (!clientSubs) {
      clientSubs = new Set()
      this.clientTradesSubscriptions.set(client.id, clientSubs)
    }

    const isNewSubscription = !clientSubs.has(subscriptionKey)
    const klineSubs = this.clientSubscriptions.get(client.id)?.size ?? 0

    // 检查总订阅数
    if (isNewSubscription && klineSubs + clientSubs.size >= MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum total subscriptions (${MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_SUBSCRIPTIONS_EXCEEDED',
      })
      client.emit('tradesSubscriptionError', {
        message: `Maximum total subscriptions (${MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        limit: MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT,
      })
      this.logger.warn({
        message: 'Client exceeded total subscription limit',
        clientId: client.id,
        klineSubs,
        tradesSubs: clientSubs.size,
        limit: MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    // 检查 Trades 订阅数
    if (isNewSubscription && clientSubs.size >= MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum trades subscriptions (${MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_TRADES_SUBSCRIPTIONS_EXCEEDED',
      })
      client.emit('tradesSubscriptionError', {
        message: `Maximum trades subscriptions (${MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        limit: MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT,
      })
      this.logger.warn({
        message: 'Client exceeded trades subscription limit',
        clientId: client.id,
        tradesSubs: clientSubs.size,
        limit: MAX_TRADES_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    this.logger.log({
      message: 'Client subscribing to trades',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      minValue,
      limit,
      subscriptionKey,
    })

    // 记录客户端订阅
    clientSubs.add(subscriptionKey)

    // 任务2: 共享定时器机制 + Socket.IO room
    const roomName = `trades:${subscriptionKey}`
    const existingSubscription = this.tradesIntervals.get(subscriptionKey)
    if (existingSubscription) {
      // 已存在定时器，将客户端加入 room
      existingSubscription.clients.add(client.id)
      await client.join(roomName)
      this.logger.log({
        message: 'Client joined existing trades subscription',
        clientId: client.id,
        subscriptionKey,
        totalClients: existingSubscription.clients.size,
      })
    } else {
      // 创建新的定时器和客户端集合
      const clients = new Set<string>([client.id])
      const params = { exchange, instrumentType, symbol, minValue, limit }

      // 将客户端加入 room
      await client.join(roomName)

      // 立即推送一次数据
      try {
        await this.broadcastTrades(subscriptionKey, roomName, params)
      } catch (error) {
        this.logger.error({
          message: 'Failed to broadcast trades data on subscribe',
          subscriptionKey,
          params,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }

      // 使用 setTimeout 链式调用防止任务堆积
      const subscriptionInfo: TradesSubscriptionInfo = {
        timer: null as unknown as NodeJS.Timeout,
        clients,
        roomName,
        isRunning: false,
        params,
      }

      let scheduleNext: () => void
      // eslint-disable-next-line prefer-const -- needs to be reassigned for mutual recursion
      scheduleNext = () => {
        subscriptionInfo.timer = setTimeout(async () => {
          // 检查订阅是否仍然存在
          if (!this.tradesIntervals.has(subscriptionKey)) {
            return
          }

          // 防止任务堆积：如果上一次还在运行，跳过本次
          if (subscriptionInfo.isRunning) {
            this.logger.warn({
              message: 'Previous trades polling still running, skipping',
              subscriptionKey,
              params: subscriptionInfo.params,
            })
            scheduleNext()
            return
          }

          try {
            subscriptionInfo.isRunning = true

            const clientCount = subscriptionInfo.clients.size
            if (clientCount === 0) {
              this.logger.log({
                message: 'No clients subscribed, stopping trades polling',
                subscriptionKey,
              })
              this.cleanupTradesSubscription(subscriptionKey)
              return
            }

            await this.broadcastTrades(subscriptionKey, roomName, params)
          } catch (error) {
            this.logger.error({
              message: 'Failed to poll trades data',
              subscriptionKey,
              params: subscriptionInfo.params,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            })
          } finally {
            subscriptionInfo.isRunning = false
            // 只有订阅仍存在时才调度下一次
            if (this.tradesIntervals.has(subscriptionKey)) {
              scheduleNext()
            }
          }
        }, 1000)
      }

      this.tradesIntervals.set(subscriptionKey, subscriptionInfo)
      scheduleNext()

      this.logger.log({
        message: 'Created new trades subscription timer',
        subscriptionKey,
        totalClients: clients.size,
      })
    }

    // 发送订阅成功确认
    client.emit('tradesSubscribed', {
      exchange,
      instrumentType,
      symbol,
      minValue,
      subscriptionKey,
    })
  }

  @SubscribeMessage('unsubscribeTrades')
  handleUnsubscribeTrades(
    @MessageBody() data: TradesSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): void {
    this.updateClientActivity(client)
    const { exchange, instrumentType, symbol, minValue } = data

    const subscriptionKey = this.getTradesSubscriptionKey(
      exchange,
      instrumentType,
      symbol,
      minValue,
    )

    this.logger.log({
      message: 'Client unsubscribing from trades',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      minValue,
      subscriptionKey,
    })

    // 移除客户端订阅记录
    const clientSubs = this.clientTradesSubscriptions.get(client.id)
    if (clientSubs) {
      clientSubs.delete(subscriptionKey)
    }

    // 从共享订阅中移除客户端
    this.removeClientFromTradesSubscription(client.id, subscriptionKey)

    // 发送取消订阅确认
    client.emit('tradesUnsubscribed', {
      exchange,
      instrumentType,
      symbol,
      minValue,
      subscriptionKey,
    })
  }

  @SubscribeMessage('subscribeOrderbook')
  async handleSubscribeOrderbook(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: OrderbookSubscriptionDto,
  ): Promise<void> {
    this.updateClientActivity(client)

    const { exchange, instrumentType, symbol, isAggregated = false, depth = 60 } = dto

    // 检查订阅数限制
    const currentSubs = this.clientOrderbookSubscriptions.get(client.id) || new Set()
    if (currentSubs.size >= MAX_ORDERBOOK_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum orderbook subscriptions (${MAX_ORDERBOOK_SUBSCRIPTIONS_PER_CLIENT}) reached`,
      })
      return
    }

    // 生成订阅键
    const subscriptionKey = `${exchange}:${instrumentType}:${symbol}:${isAggregated ? 'agg' : 'single'}:${depth}`
    const roomName = `orderbook:${subscriptionKey}`

    // 将客户端加入 Room
    await client.join(roomName)

    // 记录客户端订阅
    if (!this.clientOrderbookSubscriptions.has(client.id)) {
      this.clientOrderbookSubscriptions.set(client.id, new Set())
    }
    this.clientOrderbookSubscriptions.get(client.id)!.add(subscriptionKey)

    // 检查是否已存在共享订阅
    let subInfo = this.orderbookIntervals.get(subscriptionKey)

    if (!subInfo) {
      // 创建新的共享订阅 - 使用 setTimeout 链式调用防止任务堆积
      const clients = new Set<string>([client.id])
      const params = { exchange, instrumentType, symbol, isAggregated, depth }

      const subscriptionInfo: OrderbookSubscriptionInfo = {
        timer: null as unknown as NodeJS.Timeout,
        clients,
        roomName,
        isRunning: false,
        params,
      }

      let scheduleNext: () => void

      const runOrderbookBroadcast = async (): Promise<void> => {
        if (subscriptionInfo.isRunning) {
          return
        }

        subscriptionInfo.isRunning = true

        try {
          if (!this.orderbookIntervals.has(subscriptionKey)) {
            return
          }

          try {
            const clientCount = subscriptionInfo.clients.size
            if (clientCount === 0) {
              this.logger.log({
                message: 'No clients subscribed, stopping orderbook polling',
                subscriptionKey,
              })
              this.cleanupOrderbookSubscription(subscriptionKey)
              return
            }

            await this.broadcastOrderbook(subscriptionKey, roomName, params)
          } catch (error) {
            this.logger.error({
              message: 'Failed to poll orderbook data',
              subscriptionKey,
              params: subscriptionInfo.params,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            })
          } finally {
            subscriptionInfo.isRunning = false
          }
        } finally {
          if (this.orderbookIntervals.has(subscriptionKey)) {
            scheduleNext()
          }
        }
      }

       
      scheduleNext = () => {
        subscriptionInfo.timer = setTimeout(async () => {
          await runOrderbookBroadcast()
        }, 1000) // 1 秒推送一次
      }

      this.orderbookIntervals.set(subscriptionKey, subscriptionInfo)
      subInfo = subscriptionInfo

      void runOrderbookBroadcast()

      this.logger.log({
        message: 'Created new orderbook subscription',
        subscriptionKey,
        clientId: client.id,
      })
    } else {
      // 加入现有订阅
      subInfo.clients.add(client.id)
      this.logger.log({
        message: 'Joined existing orderbook subscription',
        subscriptionKey,
        clientId: client.id,
        totalClients: subInfo.clients.size,
      })
    }

    // 发送订阅确认
    client.emit('orderbookSubscribed', {
      exchange,
      instrumentType,
      symbol,
      isAggregated,
      depth,
      subscriptionKey,
    })
  }

  @SubscribeMessage('unsubscribeOrderbook')
  async handleUnsubscribeOrderbook(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: OrderbookSubscriptionDto,
  ): Promise<void> {
    this.updateClientActivity(client)
    const { exchange, instrumentType, symbol, isAggregated = false, depth = 60 } = dto

    const subscriptionKey = `${exchange}:${instrumentType}:${symbol}:${isAggregated ? 'agg' : 'single'}:${depth}`
    const roomName = `orderbook:${subscriptionKey}`

    // 从 Room 移除
    await client.leave(roomName)

    // 移除客户端订阅记录
    const clientSubs = this.clientOrderbookSubscriptions.get(client.id)
    if (clientSubs) {
      clientSubs.delete(subscriptionKey)
    }

    // 检查共享订阅
    const subInfo = this.orderbookIntervals.get(subscriptionKey)
    if (subInfo) {
      subInfo.clients.delete(client.id)

      // 如果没有客户端订阅了，清理定时器
      if (subInfo.clients.size === 0) {
        clearTimeout(subInfo.timer)
        this.orderbookIntervals.delete(subscriptionKey)
        this.logger.log({
          message: 'Cleared orderbook subscription (no clients)',
          subscriptionKey,
        })
      }
    }

    client.emit('orderbookUnsubscribed', {
      exchange,
      instrumentType,
      symbol,
      isAggregated,
      subscriptionKey,
    })
  }

  @SubscribeMessage('subscribeTicker')
  async handleSubscribeTicker(
    @MessageBody() data: TickerSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.updateClientActivity(client)

    // 解析参数，使用默认值
    const exchange = data.exchange ?? 'BINANCE'
    const instrumentType = data.instrumentType ?? 'PERPETUAL'
    const { baseSymbol, quoteAsset, klineSymbol } = this.resolveTickerSymbols(
      data.symbol,
      data.quoteAsset,
    )
    const symbol = baseSymbol // 基础币种，例如 'BTC'

    const subscriptionKey = this.getTickerSubscriptionKey(
      exchange,
      instrumentType,
      symbol,
      quoteAsset,
    )

    this.logger.log({
      message: 'Client subscribing to ticker',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      subscriptionKey,
    })

    // 初始化客户端订阅集合
    let clientSubs = this.clientTickerSubscriptions.get(client.id)
    if (!clientSubs) {
      clientSubs = new Set()
      this.clientTickerSubscriptions.set(client.id, clientSubs)
    }

    const isNewSubscription = !clientSubs.has(subscriptionKey)

    // 计算总订阅数（需要检查所有类型的订阅）
    const totalSubs = this.getTotalSubscriptionsForClient(client.id)

    // 检查总订阅数限制
    if (isNewSubscription && totalSubs >= MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum total subscriptions (${MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_SUBSCRIPTIONS_EXCEEDED',
      })
      this.logger.warn({
        message: 'Client exceeded total subscription limit',
        clientId: client.id,
        totalSubs,
        limit: MAX_TOTAL_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    // 检查 Ticker 订阅数限制
    if (isNewSubscription && clientSubs.size >= MAX_TICKER_SUBSCRIPTIONS_PER_CLIENT) {
      client.emit('error', {
        message: `Maximum ticker subscriptions (${MAX_TICKER_SUBSCRIPTIONS_PER_CLIENT}) reached`,
        code: 'MAX_TICKER_SUBSCRIPTIONS_EXCEEDED',
      })
      this.logger.warn({
        message: 'Client exceeded ticker subscription limit',
        clientId: client.id,
        tickerSubs: clientSubs.size,
        limit: MAX_TICKER_SUBSCRIPTIONS_PER_CLIENT,
      })
      return
    }

    // 记录客户端订阅
    clientSubs.add(subscriptionKey)

    // 设置 Socket.IO room
    const roomName = `ticker:${subscriptionKey}`

    // 检查是否已存在共享订阅
    const existingSubscription = this.tickerIntervals.get(subscriptionKey)
    if (existingSubscription) {
      // 已存在定时器，将客户端加入 room
      existingSubscription.clients.add(client.id)
      await client.join(roomName)
      this.logger.log({
        message: 'Client joined existing ticker subscription',
        clientId: client.id,
        subscriptionKey,
        totalClients: existingSubscription.clients.size,
      })
    } else {
      // 创建新的共享订阅
      const clients = new Set<string>([client.id])
      const params = { exchange, instrumentType, symbol, quoteAsset }

      // 将客户端加入 room
      await client.join(roomName)

      // 创建 K线回调函数（用于获取最新价格）
      // 注意：K线订阅的 symbol 是完整交易对，例如 'BTCUSDT'
      const klineInterval = '1m'

      const klineCallback = (bar: KlineBarDto) => {
        const subInfo = this.tickerIntervals.get(subscriptionKey)
        if (subInfo) {
          subInfo.lastKlinePrice = bar.close
        }
      }

      // 订阅 K线聚合器（获取实时价格）
      this.klineAggregatorService.subscribe(
        exchange,
        instrumentType,
        klineSymbol,
        klineInterval,
        klineCallback,
      )

      // 创建订阅信息
      const subscriptionInfo: TickerSubscriptionInfo = {
        timer: null as unknown as NodeJS.Timeout,
        clients,
        roomName,
        isRunning: false,
        lastKlinePrice: null,
        klineCallback,
        params,
      }

      // 使用 setTimeout 链式调用防止任务堆积
      const scheduleNext = () => {
        subscriptionInfo.timer = setTimeout(async () => {
          // 检查订阅是否仍然存在
          if (!this.tickerIntervals.has(subscriptionKey)) {
            return
          }

          // 防止任务堆积
          if (subscriptionInfo.isRunning) {
            this.logger.warn({
              message: 'Previous ticker broadcast still running, skipping',
              subscriptionKey,
            })
            scheduleNext()
            return
          }

          try {
            subscriptionInfo.isRunning = true

            const clientCount = subscriptionInfo.clients.size
            if (clientCount === 0) {
              this.logger.log({
                message: 'No clients subscribed, stopping ticker polling',
                subscriptionKey,
              })
              this.cleanupTickerSubscription(subscriptionKey)
              return
            }

            await this.broadcastTicker(subscriptionKey, roomName, subscriptionInfo)
          } catch (error) {
            this.logger.error({
              message: 'Failed to broadcast ticker data',
              subscriptionKey,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            })
          } finally {
            subscriptionInfo.isRunning = false
            // 只有订阅仍存在时才调度下一次
            if (this.tickerIntervals.has(subscriptionKey)) {
              scheduleNext()
            }
          }
        }, 1000) // 1秒广播一次
      }

      this.tickerIntervals.set(subscriptionKey, subscriptionInfo)

      // 立即广播一次
      try {
        await this.broadcastTicker(subscriptionKey, roomName, subscriptionInfo)
      } catch (error) {
        this.logger.error({
          message: 'Failed to broadcast ticker on subscribe',
          subscriptionKey,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // 启动定时广播
      scheduleNext()

      this.logger.log({
        message: 'Created new ticker subscription',
        subscriptionKey,
        totalClients: clients.size,
      })
    }

    // 发送订阅成功确认
    client.emit('tickerSubscribed', {
      exchange,
      instrumentType,
      symbol,
      subscriptionKey,
    })
  }

  @SubscribeMessage('unsubscribeTicker')
  async handleUnsubscribeTicker(
    @MessageBody() data: TickerSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.updateClientActivity(client)

    const exchange = data.exchange ?? 'BINANCE'
    const instrumentType = data.instrumentType ?? 'PERPETUAL'
    const { baseSymbol, quoteAsset } = this.resolveTickerSymbols(data.symbol, data.quoteAsset)
    const symbol = baseSymbol

    const subscriptionKey = this.getTickerSubscriptionKey(
      exchange,
      instrumentType,
      symbol,
      quoteAsset,
    )

    this.logger.log({
      message: 'Client unsubscribing from ticker',
      clientId: client.id,
      exchange,
      instrumentType,
      symbol,
      subscriptionKey,
    })

    // 移除客户端订阅记录
    const clientSubs = this.clientTickerSubscriptions.get(client.id)
    if (clientSubs) {
      clientSubs.delete(subscriptionKey)
    }

    // 从共享订阅中移除客户端
    this.removeClientFromTickerSubscription(client.id, subscriptionKey)

    // 发送取消订阅确认
    client.emit('tickerUnsubscribed', {
      exchange,
      instrumentType,
      symbol,
      subscriptionKey,
    })
  }

  private async broadcastTicker(
    subscriptionKey: string,
    roomName: string,
    subInfo: TickerSubscriptionInfo,
  ): Promise<void> {
    const { symbol, exchange } = subInfo.params
    const startTime = Date.now()

    try {
      const dbTicker = await this.getCachedTicker(symbol, exchange)

      const tickerData: TickerBroadcastDto = {
        symbol,
        currentPrice:
          subInfo.lastKlinePrice ?? (dbTicker?.currentPrice ? Number(dbTicker.currentPrice) : null),
        indexPrice: dbTicker?.indexPrice ? Number(dbTicker.indexPrice) : null,
        fundingRate: dbTicker?.fundingRate ? Number(dbTicker.fundingRate) : null,
        priceChangePercent24h: dbTicker?.priceChangePercent24h
          ? Number(dbTicker.priceChangePercent24h)
          : null,
        volumeUsd: dbTicker?.volumeUsd ? Number(dbTicker.volumeUsd) : null,
        openInterestUsd: dbTicker?.openInterestUsd ? Number(dbTicker.openInterestUsd) : null,
        high24h: dbTicker?.high24h ? Number(dbTicker.high24h) : null,
        low24h: dbTicker?.low24h ? Number(dbTicker.low24h) : null,
        timestamp: Date.now(),
      }

      this.server.to(roomName).emit('ticker', tickerData)
    } catch (error) {
      this.logger.error({
        message: 'Error broadcasting ticker',
        subscriptionKey,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      const durationMs = Date.now() - startTime
      if (durationMs > 800) {
        this.logger.warn({
          message: 'Ticker broadcast slow',
          subscriptionKey,
          durationMs,
        })
      }
    }
  }

  private async getCachedTicker(
    symbol: string,
    exchange?: string,
  ): Promise<Awaited<ReturnType<MarketsService['getTicker']>>> {
    const cacheKey = `${exchange ?? 'ALL'}:${symbol}`
    const cached = this.tickerDbCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.TICKER_DB_CACHE_TTL_MS) {
      return cached.data
    }

    const data = await this.marketsService.getTicker(symbol, exchange)
    this.tickerDbCache.set(cacheKey, { data, timestamp: now })

    return data
  }

  /**
   * 任务2 & 任务3: 广播 Trades 数据给所有订阅客户端（带 Redis 缓存）
   * 使用 Socket.IO room 机制实现高效广播
   */
  private async broadcastTrades(
    subscriptionKey: string,
    roomName: string,
    params: TradesSubscriptionInfo['params'],
  ): Promise<void> {
    const { exchange, instrumentType, symbol, minValue, limit } = params
    const startTime = Date.now()

    // 任务3: Redis 缓存层
    const cacheKey = `trades:${exchange}:${instrumentType}:${symbol}:${minValue ?? 'all'}`

    // 定义格式化后的交易数据类型
    interface FormattedTrade {
      id: string
      exchange: string
      instrumentType: string
      symbol: string
      baseAsset: string
      quoteAsset: string
      tradeId: string
      price: string
      size: string
      side: string
      tradeTimestamp: string
      createdAt: string
    }

    const queryTimeoutMs = 5000
    const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), queryTimeoutMs)

      try {
        const result = await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Database query timeout'))
            })
          }),
        ])
        return result
      } finally {
        clearTimeout(timeoutId)
      }
    }

    // 先尝试从缓存获取格式化后的数据
    let formattedTrades = await this.cacheService.get<FormattedTrade[]>(cacheKey)

    try {
      if (!formattedTrades) {
        // 缓存未命中，查询数据库（添加超时控制）
        let rawTrades: MarketTrade[]
        try {
          if (minValue !== undefined && minValue > 0) {
            rawTrades = await withTimeout(
              this.marketsService.getLargeTrades(exchange, instrumentType, symbol, minValue, limit),
            )
          } else {
            rawTrades = await withTimeout(
              this.marketsService.getLatestTrades(exchange, instrumentType, symbol, limit),
            )
          }
        } catch (error) {
          this.logger.error({
            message: 'Failed to fetch trades data',
            subscriptionKey,
            params: { exchange, instrumentType, symbol, minValue, limit },
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }

        // 立即格式化数据（将 BigInt 转为 string）
        formattedTrades = rawTrades.map((trade: MarketTrade) => ({
          id: trade.id.toString(),
          exchange: trade.exchange,
          instrumentType: trade.instrumentType,
          symbol: trade.symbol,
          baseAsset: trade.baseAsset,
          quoteAsset: trade.quoteAsset,
          tradeId: trade.tradeId,
          price: trade.price.toString(),
          size: trade.size.toString(),
          side: trade.side,
          tradeTimestamp: trade.tradeTimestamp.toString(),
          createdAt: trade.createdAt.toISOString(),
        }))

        // 写入缓存格式化后的数据，TTL 1秒
        await this.cacheService.set(cacheKey, formattedTrades, 1)
      }

      // 使用 Socket.IO room 机制一次性广播给所有订阅客户端
      // 比循环遍历 clients 更高效，Socket.IO 内部会优化批量发送
      this.server.to(roomName).emit('trades', {
        exchange,
        instrumentType,
        symbol,
        trades: formattedTrades,
      })
    } finally {
      const durationMs = Date.now() - startTime
      if (durationMs > 800) {
        this.logger.warn({
          message: 'Trades broadcast slow',
          subscriptionKey,
          durationMs,
          params: { exchange, instrumentType, symbol, minValue, limit },
        })
      }
    }
  }

  private async broadcastOrderbook(
    subscriptionKey: string,
    roomName: string,
    params: {
      exchange: string
      instrumentType: string
      symbol: string
      isAggregated: boolean
      depth: number
    },
  ): Promise<void> {
    const subInfo = this.orderbookIntervals.get(subscriptionKey)
    if (!subInfo) return

    const startTime = Date.now()
    try {
      const { exchange, instrumentType, symbol, isAggregated, depth } = params

      // 尝试从缓存获取
      const cacheKey = `orderbook:${exchange}:${instrumentType}:${symbol}:${isAggregated ? 'agg' : 'single'}:${depth}`
      let orderbookData = await this.cacheService.get<OrderbookPayload>(cacheKey)

      if (!orderbookData) {
        if (isAggregated) {
          // 聚合模式：调用 AggregatedOrderbookService
          // 从 symbol 中提取 base（移除 USDT/USDC 后缀）
          const base = symbol.replace(/USD[TC]$/i, '')
          const type = instrumentType === 'SPOT' ? 'spot' : 'perp'

          this.logger.debug({
            message: 'Fetching aggregated orderbook',
            symbol,
            base,
            type,
            depth,
          })

          orderbookData = await this.aggregatedOrderbookService.getAggregatedOrderbook({
            base,
            type,
            venues: undefined, // 所有交易所
            depth,
            tickSize: undefined, // 使用默认值
          })
        } else {
          // 单交易所模式：从 Redis 读取
          // 构建 venueId: binance-spot, binance-perp, okx-spot, etc.
          const venueType = instrumentType === 'SPOT' ? 'spot' : 'perp'
          const venueId = `${exchange.toLowerCase()}-${venueType}`

          // 从 symbol 中提取 base（移除 USDT/USDC 后缀）
          // 例如: BTCUSDT -> BTC, ETHUSDC -> ETH
          const base = symbol.replace(/USD[TC]$/i, '')

          // 构建 marketKey: BTC-USDT:spot, ETH-USDT:perp
          // 注意：Redis 中存储的是 USDT 计价的订单簿
          const marketKey = `${base}-USDT:${venueType}`
          const redisKey = `orderbook:${venueId}:${marketKey}`

          this.logger.debug({
            message: 'Fetching single venue orderbook from Redis',
            symbol,
            base,
            venueId,
            marketKey,
            redisKey,
          })

          const rawData = await this.redisService.getClient().get(redisKey)
          if (rawData) {
            try {
              const parsed = JSON.parse(rawData) as VenueOrderBook
              // 截取前 depth 档
              orderbookData = {
                bids: parsed.bids.slice(0, depth),
                asks: parsed.asks.slice(0, depth),
                venueId,
                marketKey,
                updatedAt: parsed.receivedTs || Date.now(),
              }

              this.logger.debug({
                message: 'Orderbook data fetched from Redis',
                redisKey,
                bidsCount: parsed.bids.length,
                asksCount: parsed.asks.length,
                bestBid: parsed.bids[0]?.price,
                bestAsk: parsed.asks[0]?.price,
              })
            } catch (error) {
              this.logger.warn({
                message: 'Failed to parse orderbook snapshot',
                redisKey,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          } else {
            this.logger.warn({
              message: 'No orderbook data found in Redis',
              redisKey,
              exchange,
              instrumentType,
              symbol,
            })
          }
        }

        // 写入缓存（TTL 1 秒）
        if (orderbookData) {
          await this.cacheService.set(cacheKey, orderbookData, 1)
        }
      }

      if (orderbookData) {
        // 广播到 Room
        this.server.to(roomName).emit('orderbook', {
          exchange,
          instrumentType,
          symbol,
          isAggregated,
          orderbook: orderbookData,
        })
      } else {
        this.logger.warn({
          message: 'No orderbook data to broadcast',
          subscriptionKey,
          params,
        })
      }
    } catch (error) {
      this.logger.error({
        message: 'Error broadcasting orderbook',
        subscriptionKey,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      const durationMs = Date.now() - startTime
      if (durationMs > 800) {
        this.logger.warn({
          message: 'Orderbook broadcast slow',
          subscriptionKey,
          durationMs,
        })
      }
    }
  }

  /**
   * 从共享订阅中移除客户端
   */
  private removeClientFromTradesSubscription(clientId: string, subscriptionKey: string): void {
    const subscription = this.tradesIntervals.get(subscriptionKey)
    if (subscription) {
      subscription.clients.delete(clientId)

      // 让客户端离开 room（如果 socket 仍然连接）
      // 添加空值检查以防止运行时错误
      if (this.server?.sockets?.sockets) {
        const socket = this.server.sockets.sockets.get(clientId)
        if (socket) {
          socket.leave(subscription.roomName)
        }
      }

      this.logger.log({
        message: 'Client removed from trades subscription',
        clientId,
        subscriptionKey,
        remainingClients: subscription.clients.size,
      })

      // 如果没有客户端了，清理定时器
      if (subscription.clients.size === 0) {
        this.cleanupTradesSubscription(subscriptionKey)
      }
    }
  }

  private cleanupTradesSubscription(subscriptionKey: string): void {
    const subscription = this.tradesIntervals.get(subscriptionKey)
    if (subscription) {
      // 使用 clearTimeout 因为我们改用了 setTimeout 链式调用
      clearTimeout(subscription.timer)
      this.tradesIntervals.delete(subscriptionKey)

      this.logger.log({
        message: 'Cleaned up trades subscription timer',
        subscriptionKey,
      })
    }
  }

  private cleanupOrderbookSubscription(subscriptionKey: string): void {
    const subscription = this.orderbookIntervals.get(subscriptionKey)
    if (subscription) {
      // 使用 clearTimeout 因为我们改用了 setTimeout 链式调用
      clearTimeout(subscription.timer)
      this.orderbookIntervals.delete(subscriptionKey)

      this.logger.log({
        message: 'Cleaned up orderbook subscription timer',
        subscriptionKey,
      })
    }
  }

  private getTradesSubscriptionKey(
    exchange: string,
    instrumentType: string,
    symbol: string,
    minValue: number | undefined,
  ): string {
    const minValueStr = minValue !== undefined ? `:${minValue}` : ''
    return `trades:${exchange}:${instrumentType}:${symbol.toUpperCase()}${minValueStr}`
  }

  @Interval(60000)
  cleanupStaleConnections(): void {
    const now = Date.now()

    const socketsCollection = this.getSocketsCollection()
    const handleSocket = (socket: Socket): void => {
      try {
        // NOTE:
        // lastActivity 目前只会在「客户端 -> 服务端」的事件中更新（subscribe/unsubscribe 等）。
        // 对于只订阅并被动接收推送的正常连接，如果用 lastActivity 作为唯一依据，会被误判为 stale。
        // 因此 stale 清理只应针对“真正闲置”的连接（无任何订阅且未加入业务 room）。
        if (!this.isSocketEffectivelyIdle(socket)) {
          this.logger.debug({
            message: 'Skipping stale disconnect (socket has active subscriptions/rooms)',
            clientId: socket.id,
            rooms: this.getBusinessRoomCount(socket),
            klineSubs: this.clientSubscriptions.get(socket.id)?.size ?? 0,
            tradesSubs: this.clientTradesSubscriptions.get(socket.id)?.size ?? 0,
            orderbookSubs: this.clientOrderbookSubscriptions.get(socket.id)?.size ?? 0,
          })
          return
        }

        const lastActivity = this.getLastActivity(socket)
        if (now - lastActivity > STALE_CONNECTION_THRESHOLD_MS) {
          this.logger.warn({
            message: 'Disconnecting stale connection',
            clientId: socket.id,
            inactiveDuration: now - lastActivity,
          })
          socket.disconnect(true)
        }
      } catch (error) {
        this.logger.error({
          message: 'Error during stale connection cleanup',
          clientId: socket.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (this.hasSocketForEach(socketsCollection)) {
      socketsCollection.forEach(handleSocket)
      return
    }

    if (this.isSocketIterable(socketsCollection)) {
      for (const socket of socketsCollection) {
        handleSocket(socket)
      }
      return
    }

    this.logger.warn({
      message: 'Socket collection missing or not iterable during stale connection cleanup',
    })
  }

  private getSocketsCollection(): unknown {
    const server: unknown = this.server
    if (!this.isRecord(server)) {
      return undefined
    }

    const sockets = server.sockets
    if (this.isRecord(sockets) && 'sockets' in sockets) {
      return sockets.sockets
    }

    return sockets
  }

  private hasSocketForEach(
    value: unknown,
  ): value is { forEach: (callback: (socket: Socket) => void) => void } {
    return this.isRecord(value) && typeof value.forEach === 'function'
  }

  private isSocketIterable(value: unknown): value is Iterable<Socket> {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
      return false
    }

    const maybeIterable = value as { [Symbol.iterator]?: unknown }
    return typeof maybeIterable[Symbol.iterator] === 'function'
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private updateClientActivity(client: Socket): void {
    client.data.lastActivity = Date.now()
  }

  private getLastActivity(client: Socket): number {
    const lastActivity = client.data.lastActivity
    if (typeof lastActivity === 'number' && Number.isFinite(lastActivity)) {
      return lastActivity
    }

    const handshakeTime = client.handshake.time
    const parsedTime = typeof handshakeTime === 'string' ? Date.parse(handshakeTime) : Number.NaN
    if (Number.isFinite(parsedTime)) {
      return parsedTime
    }

    return Date.now()
  }

  private getTickerSubscriptionKey(
    exchange: string,
    instrumentType: string,
    symbol: string,
    quoteAsset: string,
  ): string {
    return `${exchange}:${instrumentType}:${symbol.toUpperCase()}:${quoteAsset.toUpperCase()}`
  }

  private resolveTickerSymbols(
    symbol: string,
    quoteAsset?: string,
  ): {
    baseSymbol: string
    quoteAsset: string
    klineSymbol: string
  } {
    const normalizedSymbol = symbol.trim().toUpperCase()
    const normalizedQuote = quoteAsset?.trim().toUpperCase()

    if (normalizedQuote) {
      if (normalizedSymbol.endsWith(normalizedQuote)) {
        const baseSymbol = normalizedSymbol.slice(0, -normalizedQuote.length)
        return {
          baseSymbol,
          quoteAsset: normalizedQuote,
          klineSymbol: normalizedSymbol,
        }
      }

      return {
        baseSymbol: normalizedSymbol,
        quoteAsset: normalizedQuote,
        klineSymbol: `${normalizedSymbol}${normalizedQuote}`,
      }
    }

    const detectedQuote = this.detectQuoteAsset(normalizedSymbol)
    if (detectedQuote) {
      const baseSymbol = normalizedSymbol.slice(0, -detectedQuote.length)
      return {
        baseSymbol,
        quoteAsset: detectedQuote,
        klineSymbol: normalizedSymbol,
      }
    }

    const fallbackQuote = 'USDT'
    return {
      baseSymbol: normalizedSymbol,
      quoteAsset: fallbackQuote,
      klineSymbol: `${normalizedSymbol}${fallbackQuote}`,
    }
  }

  private detectQuoteAsset(symbol: string): string | null {
    const knownQuotes = ['USDT', 'USDC', 'USD']
    return knownQuotes.find(quote => symbol.endsWith(quote)) ?? null
  }

  private getTotalSubscriptionsForClient(clientId: string): number {
    const klineSubs = this.clientSubscriptions.get(clientId)?.size ?? 0
    const tradesSubs = this.clientTradesSubscriptions.get(clientId)?.size ?? 0
    const orderbookSubs = this.clientOrderbookSubscriptions.get(clientId)?.size ?? 0
    const tickerSubs = this.clientTickerSubscriptions.get(clientId)?.size ?? 0
    return klineSubs + tradesSubs + orderbookSubs + tickerSubs
  }

  private removeClientFromTickerSubscription(clientId: string, subscriptionKey: string): void {
    const subscription = this.tickerIntervals.get(subscriptionKey)
    if (subscription) {
      subscription.clients.delete(clientId)

      // 让客户端离开 room
      if (this.server?.sockets?.sockets) {
        const socket = this.server.sockets.sockets.get(clientId)
        if (socket) {
          socket.leave(subscription.roomName)
        }
      }

      this.logger.log({
        message: 'Client removed from ticker subscription',
        clientId,
        subscriptionKey,
        remainingClients: subscription.clients.size,
      })

      // 如果没有客户端了，清理定时器
      if (subscription.clients.size === 0) {
        this.cleanupTickerSubscription(subscriptionKey)
      }
    }
  }

  private cleanupTickerSubscription(subscriptionKey: string): void {
    const subscription = this.tickerIntervals.get(subscriptionKey)
    if (subscription) {
      // 清理定时器
      clearTimeout(subscription.timer)

      // 取消订阅 K线聚合器
      const { exchange, instrumentType, symbol, quoteAsset } = subscription.params
      const klineSymbol = this.resolveTickerSymbols(symbol, quoteAsset).klineSymbol
      const klineInterval = '1m'

      this.klineAggregatorService.unsubscribe(
        exchange,
        instrumentType,
        klineSymbol,
        klineInterval,
        subscription.klineCallback,
      )

      this.tickerIntervals.delete(subscriptionKey)

      this.logger.log({
        message: 'Cleaned up ticker subscription',
        subscriptionKey,
      })
    }
  }

  private hasAnyActiveSubscriptions(clientId: string): boolean {
    const klineSubs = this.clientSubscriptions.get(clientId)
    if (klineSubs && klineSubs.size > 0) return true

    const tradesSubs = this.clientTradesSubscriptions.get(clientId)
    if (tradesSubs && tradesSubs.size > 0) return true

    const orderbookSubs = this.clientOrderbookSubscriptions.get(clientId)
    if (orderbookSubs && orderbookSubs.size > 0) return true

    const tickerSubs = this.clientTickerSubscriptions.get(clientId)
    if (tickerSubs && tickerSubs.size > 0) return true

    return false
  }

  private getBusinessRoomCount(socket: Socket): number {
    // socket.rooms 始终包含自身的 room（socket.id）。
    // 当 size > 1 时，说明加入了至少一个业务 room（如 trades/orderbook）。
    const rooms = socket.rooms
    if (!rooms || typeof (rooms as unknown as { size?: unknown }).size !== 'number') {
      return 0
    }
    const size = rooms.size
    return Math.max(0, size - 1)
  }

  private isSocketEffectivelyIdle(socket: Socket): boolean {
    // 只要加入了业务 room 或存在任何订阅，就认为是活跃连接，不应被 stale 清理踢下线。
    if (this.getBusinessRoomCount(socket) > 0) return false
    if (this.hasAnyActiveSubscriptions(socket.id)) return false
    return true
  }
}
