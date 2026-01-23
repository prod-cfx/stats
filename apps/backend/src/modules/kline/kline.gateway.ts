import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { KlineBarDto } from './dto/kline-bar.dto'
import type { KlineSubscriptionDto } from './dto/kline-subscription.dto'

import { Logger, UnauthorizedException } from '@nestjs/common'
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
import { KlineAggregatorService } from './kline-aggregator.service'


@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
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

  constructor(
    private readonly klineAggregatorService: KlineAggregatorService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      // 从握手中获取 token (支持 query 和 headers 两种方式)
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '')

      if (!token) {
        this.logger.warn({
          message: 'Client connection rejected: missing token',
          clientId: client.id,
        })
        client.disconnect()
        return
      }

      // 验证 JWT token
      const payload = this.jwtService.verify(token)

      // 将用户信息附加到 socket 对象上,供后续使用
      client.data.userId = payload.sub || payload.userId
      client.data.username = payload.username

      this.logger.log({
        message: 'Client connected',
        clientId: client.id,
        userId: client.data.userId,
      })
      this.clientSubscriptions.set(client.id, new Set())
    } catch (error) {
      const unauthorizedError = error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException(error instanceof Error ? error.message : String(error))

      this.logger.warn({
        message: 'Client connection rejected: invalid token',
        clientId: client.id,
        error: unauthorizedError.message,
      })
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log({
      message: 'Client disconnected',
      clientId: client.id,
    })

    // 清理该客户端的所有订阅
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
}
