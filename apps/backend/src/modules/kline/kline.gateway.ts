import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { KlineBarDto } from './dto/kline-bar.dto'
import type { KlineSubscriptionDto } from './dto/kline-subscription.dto'
import type { TradesSubscriptionDto } from './dto/trades-subscription.dto'

import { Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { JwtService } from '@nestjs/jwt'
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
import { MarketsService } from '../markets/markets.service'
// eslint-disable-next-line ts/consistent-type-imports
import { KlineAggregatorService } from './kline-aggregator.service'


// 单个客户端最大订阅数限制
const MAX_SUBSCRIPTIONS_PER_CLIENT = 10

// 允许的 CORS origin 正则模式
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[\w-]+\.coinflux\.com$/,
]

/**
 * 验证 CORS origin 是否合法
 */
function isValidOrigin(origin: string): boolean {
  // 检查是否为有效 URL 格式
  try {
    const url = new URL(origin)
    // 确保 URL 被使用，避免 lint 警告
    if (!url.protocol) return false
  } catch {
    return false
  }
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

/**
 * 解析并验证 ALLOWED_ORIGINS 环境变量
 */
function parseAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || []
  const validOrigins = envOrigins.filter(isValidOrigin)

  // 如果没有有效的 origin，使用默认值
  if (validOrigins.length === 0) {
    return ['http://localhost:3001']
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

@WebSocketGateway({
  cors: {
    origin: parseAllowedOrigins(),
    credentials: true,
  },
  namespace: '/kline',
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

  constructor(
    private readonly klineAggregatorService: KlineAggregatorService,
    private readonly jwtService: JwtService,
    private readonly marketsService: MarketsService,
    private readonly cacheService: CacheService,
  ) {}

  handleConnection(client: Socket): void {
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
            this.klineAggregatorService.unsubscribe(exchange, instrumentType, symbol, interval, callback)
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
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: KlineSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): void {
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

    // 记录客户端订阅
    const clientSubs = this.clientSubscriptions.get(client.id)
    if (clientSubs) {
      clientSubs.add(subscriptionKey)
    }

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
    this.klineAggregatorService.subscribe(
      exchange,
      instrumentType,
      symbol,
      interval,
      callback,
    )

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

  private getSubscriptionKey(exchange: string, instrumentType: string, symbol: string, interval: string): string {
    return `${exchange}:${instrumentType}:${symbol.toUpperCase()}:${interval}`
  }

  @SubscribeMessage('subscribeTrades')
  async handleSubscribeTrades(
    @MessageBody() data: TradesSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { exchange, instrumentType, symbol, minValue, limit = 50 } = data

    const subscriptionKey = this.getTradesSubscriptionKey(exchange, instrumentType, symbol, minValue)

    // 任务1: 速率限制 - 检查客户端当前订阅数
    let clientSubs = this.clientTradesSubscriptions.get(client.id)
    if (!clientSubs) {
      clientSubs = new Set()
      this.clientTradesSubscriptions.set(client.id, clientSubs)
    }

    // 如果客户端已经订阅了该 key，不计入新订阅
    if (!clientSubs.has(subscriptionKey) && clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
      this.logger.warn({
        message: 'Client exceeded maximum subscriptions limit',
        clientId: client.id,
        currentSubscriptions: clientSubs.size,
        limit: MAX_SUBSCRIPTIONS_PER_CLIENT,
      })

      client.emit('tradesSubscriptionError', {
        message: 'Maximum subscriptions limit reached',
        limit: MAX_SUBSCRIPTIONS_PER_CLIENT,
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
      await this.broadcastTrades(subscriptionKey, roomName, params)

      // 使用 setTimeout 链式调用防止任务堆积
      const subscriptionInfo: TradesSubscriptionInfo = {
        timer: null as unknown as NodeJS.Timeout,
        clients,
        roomName,
        isRunning: false,
        params,
      }

      const scheduleNext = () => {
        subscriptionInfo.timer = setTimeout(async () => {
          // 检查订阅是否仍然存在
          if (!this.tradesIntervals.has(subscriptionKey)) {
            return
          }

          // 防止任务堆积：如果上一次还在运行，跳过本次
          if (subscriptionInfo.isRunning) {
            scheduleNext()
            return
          }

          subscriptionInfo.isRunning = true
          try {
            await this.broadcastTrades(subscriptionKey, roomName, params)
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
    const { exchange, instrumentType, symbol, minValue } = data

    const subscriptionKey = this.getTradesSubscriptionKey(exchange, instrumentType, symbol, minValue)

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

    try {
      // 任务3: Redis 缓存层
      const cacheKey = `trades:${exchange}:${instrumentType}:${symbol}:${minValue ?? 'all'}`

      // 先尝试从缓存获取
      let trades = await this.cacheService.get<Awaited<ReturnType<typeof this.marketsService.getLatestTrades>>>(cacheKey)

      if (!trades) {
        // 缓存未命中，查询数据库
        if (minValue !== undefined && minValue > 0) {
          trades = await this.marketsService.getLargeTrades(exchange, instrumentType, symbol, minValue, limit)
        } else {
          trades = await this.marketsService.getLatestTrades(exchange, instrumentType, symbol, limit)
        }

        // 写入缓存，TTL 1秒
        await this.cacheService.set(cacheKey, trades, 1)
      }

      // 格式化数据
      const formattedTrades = trades.map((trade) => ({
        id: trade.id,
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

      // 使用 Socket.IO room 机制一次性广播给所有订阅客户端
      // 比循环遍历 clients 更高效，Socket.IO 内部会优化批量发送
      this.server.to(roomName).emit('trades', {
        exchange,
        instrumentType,
        symbol,
        trades: formattedTrades,
      })
    } catch (error) {
      this.logger.error({
        message: 'Failed to broadcast trades data',
        subscriptionKey,
        exchange,
        instrumentType,
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })
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
      const socket = this.server.sockets.sockets.get(clientId)
      if (socket) {
        socket.leave(subscription.roomName)
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

  private getTradesSubscriptionKey(
    exchange: string,
    instrumentType: string,
    symbol: string,
    minValue: number | undefined,
  ): string {
    const minValueStr = minValue !== undefined ? `:${minValue}` : ''
    return `trades:${exchange}:${instrumentType}:${symbol.toUpperCase()}${minValueStr}`
  }
}
