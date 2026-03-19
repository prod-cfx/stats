import { Injectable, Logger } from '@nestjs/common'
import WebSocket from 'ws'

export interface BinanceKlineData {
  e: string // Event type
  E: number // Event time
  s: string // Symbol
  k: {
    t: number // Kline start time
    T: number // Kline close time
    s: string // Symbol
    i: string // Interval
    o: string // Open price
    c: string // Close price
    h: string // High price
    l: string // Low price
    v: string // Base asset volume
    x: boolean // Is this kline closed?
  }
}

export interface KlineBar {
  time: number // 毫秒时间戳
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface BinanceConnection {
  ws: WebSocket
  subscribers: Set<string> // clientId 集合
  reconnectAttempts: number
  reconnectTimer?: NodeJS.Timeout
}

@Injectable()
export class BinanceWsService {
  private readonly logger = new Logger(BinanceWsService.name)
  private readonly connections = new Map<string, BinanceConnection>()
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_DELAY = 3000

  /**
   * 订阅 Binance K线数据
   * @param symbol 交易对（如 BTCUSDT）
   * @param interval K线周期（如 1m, 5m, 15m, 1h, 4h, 1d）
   * @param clientId 客户端唯一标识
   * @param onData 数据回调
   */
  subscribe(
    symbol: string,
    interval: string,
    clientId: string,
    onData: (bar: KlineBar) => void,
  ): void {
    const key = this.getConnectionKey(symbol, interval)

    // 如果连接已存在，直接添加订阅者
    const existingConnection = this.connections.get(key)
    if (existingConnection) {
      existingConnection.subscribers.add(clientId)
      this.logger.log({
        message: 'Added subscriber to existing connection',
        key,
        clientId,
        totalSubscribers: existingConnection.subscribers.size,
      })
      return
    }

    // 创建新连接
    this.createConnection(key, symbol, interval, clientId, onData)
  }

  /**
   * 取消订阅
   * @param symbol 交易对
   * @param interval K线周期
   * @param clientId 客户端唯一标识
   */
  unsubscribe(symbol: string, interval: string, clientId: string): void {
    const key = this.getConnectionKey(symbol, interval)
    const connection = this.connections.get(key)

    if (!connection) {
      return
    }

    connection.subscribers.delete(clientId)
    this.logger.log({
      message: 'Removed subscriber',
      key,
      clientId,
      remainingSubscribers: connection.subscribers.size,
    })

    // 如果没有订阅者了，关闭连接
    if (connection.subscribers.size === 0) {
      this.closeConnection(key)
    }
  }

  /**
   * 创建 Binance WebSocket 连接
   */
  private createConnection(
    key: string,
    symbol: string,
    interval: string,
    clientId: string,
    onData: (bar: KlineBar) => void,
  ): void {
    const wsSymbol = symbol.toLowerCase()
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${interval}`

    this.logger.log({
      message: 'Creating Binance WebSocket connection',
      key,
      wsUrl,
      clientId,
    })

    const ws = new WebSocket(wsUrl)
    const connection: BinanceConnection = {
      ws,
      subscribers: new Set([clientId]),
      reconnectAttempts: 0,
    }

    ws.on('open', () => {
      this.logger.log({
        message: 'Binance WebSocket connected',
        key,
        wsUrl,
      })
      connection.reconnectAttempts = 0
    })

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as BinanceKlineData

        if (message.e === 'kline') {
          const bar: KlineBar = {
            time: message.k.t,
            open: Number.parseFloat(message.k.o),
            high: Number.parseFloat(message.k.h),
            low: Number.parseFloat(message.k.l),
            close: Number.parseFloat(message.k.c),
            volume: Number.parseFloat(message.k.v),
          }

          // 广播给所有订阅者
          onData(bar)
        }
      } catch (error) {
        this.logger.error({
          message: 'Failed to parse Binance message',
          key,
          error: (error as Error).message,
        })
      }
    })

    ws.on('error', (error) => {
      this.logger.error({
        message: 'Binance WebSocket error',
        key,
        error: error.message,
      })
    })

    ws.on('close', () => {
      this.logger.warn({
        message: 'Binance WebSocket closed',
        key,
      })

      // 如果还有订阅者，尝试重连
      if (connection.subscribers.size > 0) {
        this.reconnect(key, symbol, interval, onData, connection)
      } else {
        this.connections.delete(key)
      }
    })

    this.connections.set(key, connection)
  }

  /**
   * 重连逻辑
   */
  private reconnect(
    key: string,
    symbol: string,
    interval: string,
    onData: (bar: KlineBar) => void,
    connection: BinanceConnection,
  ): void {
    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error({
        message: 'Max reconnect attempts reached, giving up',
        key,
        attempts: connection.reconnectAttempts,
      })
      this.connections.delete(key)
      return
    }

    connection.reconnectAttempts++
    const delay = this.RECONNECT_DELAY * connection.reconnectAttempts

    this.logger.log({
      message: 'Scheduling reconnect',
      key,
      attempt: connection.reconnectAttempts,
      delayMs: delay,
    })

    connection.reconnectTimer = setTimeout(() => {
      // 保存订阅者列表
      const subscribers = Array.from(connection.subscribers)
      this.connections.delete(key)

      // 重新创建连接（使用第一个订阅者的 clientId）
      if (subscribers.length > 0) {
        this.createConnection(key, symbol, interval, subscribers[0], onData)

        // 重新添加其他订阅者
        const newConnection = this.connections.get(key)
        if (newConnection) {
          subscribers.slice(1).forEach(clientId => {
            newConnection.subscribers.add(clientId)
          })
        }
      }
    }, delay)
  }

  /**
   * 关闭连接
   */
  private closeConnection(key: string): void {
    const connection = this.connections.get(key)
    if (!connection) {
      return
    }

    this.logger.log({
      message: 'Closing Binance WebSocket connection',
      key,
    })

    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer)
    }

    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close()
    }

    this.connections.delete(key)
  }

  /**
   * 生成连接键
   */
  private getConnectionKey(symbol: string, interval: string): string {
    return `${symbol.toUpperCase()}:${interval}`
  }

  /**
   * 清理所有连接（用于应用关闭时）
   */
  onModuleDestroy(): void {
    this.logger.log('Closing all Binance WebSocket connections')
    for (const [key] of this.connections) {
      this.closeConnection(key)
    }
  }
}
