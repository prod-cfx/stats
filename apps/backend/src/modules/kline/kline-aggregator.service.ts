import type { OnModuleDestroy } from '@nestjs/common'
import type { KlineBarDto } from './dto/kline-bar.dto'
import type { CurrentKline } from './interfaces/current-kline.interface'
import type { TradeEvent } from './interfaces/trade-event.interface'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { TRADE_RECEIVED_EVENT } from './interfaces/trade-event.interface'
import { getKlineStartTime } from './utils/kline-time.utils'

/**
 * K线聚合服务
 *
 * 职责:
 * 1. 监听交易事件 (TRADE_RECEIVED_EVENT)
 * 2. 将交易数据聚合成多个时间粒度的 K线
 * 3. 检测 K线周期切换,推送完整 K线
 * 4. 节流推送更新 (最多 1 秒 1 次)
 */
@Injectable()
export class KlineAggregatorService implements OnModuleDestroy {
  private readonly logger = new Logger(KlineAggregatorService.name)

  /**
   * 当前正在聚合的 K线状态
   * Key: subscriptionKey (格式: exchange:instrumentType:symbol:interval)
   */
  private readonly currentKlines = new Map<string, CurrentKline>()

  /**
   * 订阅者回调函数
   * Key: subscriptionKey
   * Value: Set of callback functions
   */
  private readonly subscribers = new Map<string, Set<(kline: KlineBarDto) => void>>()

  /**
   * Trades 订阅回调函数
   * Key: subscriptionKey
   */
  private readonly tradeCallbacks = new Map<string, (trade: TradeEvent) => void>()

  /**
   * 节流推送定时器
   * Key: subscriptionKey
   */
  private readonly throttleTimers = new Map<string, NodeJS.Timeout>()

  /**
   * 节流推送间隔 (毫秒)
   */
  private readonly THROTTLE_INTERVAL_MS = 1000

  /**
   * 支持的时间粒度
   */
  private readonly SUPPORTED_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d']

  onModuleDestroy() {
    // 清理所有定时器
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer)
    }
    this.throttleTimers.clear()
    this.currentKlines.clear()
    this.subscribers.clear()
  }

  /**
   * 订阅 K线更新
   *
   * @param exchange 交易所代码
   * @param instrumentType 合约类型
   * @param symbol 交易对符号
   * @param interval 时间粒度
   * @param callback 回调函数
   */
  subscribe(
    exchange: string,
    instrumentType: string,
    symbol: string,
    interval: string,
    callback: (kline: KlineBarDto) => void,
  ): void {
    const key = this.getSubscriptionKey(exchange, instrumentType, symbol, interval)

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }

    this.subscribers.get(key)!.add(callback)

    this.logger.log({
      message: 'Client subscribed to aggregated kline',
      subscriptionKey: key,
      subscriberCount: this.subscribers.get(key)!.size,
    })
  }

  /**
   * 取消订阅 K线更新
   *
   * @param exchange 交易所代码
   * @param instrumentType 合约类型
   * @param symbol 交易对符号
   * @param interval 时间粒度
   * @param callback 回调函数
   */
  unsubscribe(
    exchange: string,
    instrumentType: string,
    symbol: string,
    interval: string,
    callback: (kline: KlineBarDto) => void,
  ): void {
    const key = this.getSubscriptionKey(exchange, instrumentType, symbol, interval)

    const callbacks = this.subscribers.get(key)
    if (callbacks) {
      callbacks.delete(callback)

      if (callbacks.size === 0) {
        this.subscribers.delete(key)
        this.currentKlines.delete(key)

        // 清理节流定时器
        const timer = this.throttleTimers.get(key)
        if (timer) {
          clearTimeout(timer)
          this.throttleTimers.delete(key)
        }

        this.tradeCallbacks.delete(key)

        this.logger.log({
          message: 'All clients unsubscribed, cleaned up kline state',
          subscriptionKey: key,
        })
      } else {
        this.logger.log({
          message: 'Client unsubscribed from aggregated kline',
          subscriptionKey: key,
          remainingSubscribers: callbacks.size,
        })
      }
    }
  }

  /**
   * 监听交易事件
   * 由 EventEmitter2 自动调用
   */
  @OnEvent(TRADE_RECEIVED_EVENT)
  onTradeReceived(trade: TradeEvent): void {
    // 为所有支持的时间粒度更新 K线
    for (const interval of this.SUPPORTED_INTERVALS) {
      this.updateKline(trade, interval)
    }
  }

  /**
   * 更新 K线数据
   *
   * @param trade 交易事件
   * @param interval 时间粒度
  */
  private updateKline(trade: TradeEvent, interval: string): void {
    const isValidPrice = Number.isFinite(trade.price) && trade.price > 0
    if (!isValidPrice) {
      this.logger.warn({
        message: 'Invalid trade price, skipping kline update',
        exchange: trade.exchange,
        instrumentType: trade.instrumentType,
        symbol: trade.symbol,
        price: trade.price,
        size: trade.size,
        timestamp: trade.timestamp,
      })
      return
    }

    const key = this.getSubscriptionKey(trade.exchange, trade.instrumentType, trade.symbol, interval)

    // 如果没有订阅者,跳过聚合
    if (!this.subscribers.has(key) || this.subscribers.get(key)!.size === 0) {
      return
    }

    const newStartTime = getKlineStartTime(trade.timestamp, interval)
    const current = this.currentKlines.get(key)

    // 检测周期切换
    if (!current || current.startTime !== newStartTime) {
      // 推送旧 K线 (如果存在)
      if (current) {
        this.pushKlineImmediately(key)
      }

      // 创建新 K线
      this.currentKlines.set(key, {
        subscriptionKey: key,
        exchange: trade.exchange,
        instrumentType: trade.instrumentType,
        symbol: trade.symbol,
        interval,
        startTime: newStartTime,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        // volume 使用 USD 名义价值，保持与历史 volumeUsd 一致
        volume: trade.price * trade.size,
        tradeCount: 1,
        lastUpdateTime: trade.timestamp,
      })

      this.logger.debug({
        message: 'New kline period started',
        subscriptionKey: key,
        startTime: new Date(newStartTime).toISOString(),
        price: trade.price,
      })
    } else {
      // 更新当前 K线
      current.high = Math.max(current.high, trade.price)
      current.low = Math.min(current.low, trade.price)
      current.close = trade.price
      // volume 使用 USD 名义价值，保持与历史 volumeUsd 一致
      current.volume += trade.price * trade.size
      current.tradeCount++
      current.lastUpdateTime = trade.timestamp
    }

    // 调度节流推送
    this.scheduleThrottledPush(key)
  }

  /**
   * 调度节流推送
   * 确保同一 subscriptionKey 最多 1 秒推送 1 次
   *
   * @param key subscriptionKey
   */
  private scheduleThrottledPush(key: string): void {
    // 如果已有定时器,不重复创建
    if (this.throttleTimers.has(key)) {
      return
    }

    const timer = setTimeout(() => {
      this.pushKlineImmediately(key)
      this.throttleTimers.delete(key)
    }, this.THROTTLE_INTERVAL_MS)

    this.throttleTimers.set(key, timer)
  }

  /**
   * 立即推送 K线给所有订阅者
   *
   * @param key subscriptionKey
   */
  private pushKlineImmediately(key: string): void {
    const current = this.currentKlines.get(key)
    if (!current) {
      return
    }

    const callbacks = this.subscribers.get(key)
    if (!callbacks || callbacks.size === 0) {
      return
    }

    const bar: KlineBarDto = {
      time: current.startTime,
      open: current.open,
      high: current.high,
      low: current.low,
      close: current.close,
      volume: current.volume,
    }

    // 推送给所有订阅者
    for (const callback of callbacks) {
      try {
        callback(bar)
      } catch (error) {
        this.logger.error({
          message: 'Failed to push kline to subscriber',
          subscriptionKey: key,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    this.logger.debug({
      message: 'Pushed kline to subscribers',
      subscriptionKey: key,
      subscriberCount: callbacks.size,
      bar,
    })
  }

  /**
   * 生成订阅键
   *
   * @param exchange 交易所代码
   * @param instrumentType 合约类型
   * @param symbol 交易对符号
   * @param interval 时间粒度
   * @returns subscriptionKey
   */
  private getSubscriptionKey(
    exchange: string,
    instrumentType: string,
    symbol: string,
    interval: string,
  ): string {
    return `${exchange}:${instrumentType}:${symbol}:${interval}`
  }
}
