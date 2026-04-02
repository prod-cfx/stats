/**
 * TradingView Charting Library - Mock Datafeed
 *
 * 目标：
 * - 先用 mock K 线数据跑通 Charting Library（商业版）
 * - 后端数据准备好后，只需要把 getBars() 改成真实请求并映射成 bars 即可（无痛替换）
 *
 * ✅ 真实后端接入点：mock-datafeed.getBars() 里 TODO 标注的位置。
 *
 * 注意：
 * - 不要 import charting_library 代码（它是静态资源，通过 <script> 加载到 window.TradingView）
 */

import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client'
import { fetchKlineData } from '@/lib/api'
import { getWsBaseUrl } from '@/lib/ws'
import { logger } from '@/utils/logger'

export type TvResolution = '1' | '5' | '15' | '60' | '240' | '1D'

export interface TvBar {
  time: number // 毫秒时间戳
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * WebSocket 事件数据类型定义
 */

// K线事件数据
interface KlineEventData {
  symbol: string
  interval: string
  bar: TvBar
  timestamp?: number
}

// 订阅确认事件数据
interface SubscriptionConfirmData {
  symbol: string
  interval: string
  subscriptionKey: string
}


interface OnReadyCallback {
  (config: { supported_resolutions: TvResolution[] }): void
}

interface ResolveCallback {
  (symbolInfo: Record<string, unknown>): void
}

interface ErrorCallback {
  (reason: string): void
}

interface BarsCallback {
  (bars: TvBar[], meta: { noData?: boolean }): void
}

interface PeriodParams {
  from: number // 秒
  to: number // 秒
  firstDataRequest: boolean
  countBack?: number
}

interface SubscribeCallback {
  (bar: TvBar): void
}

// 订阅管理
interface Subscription {
  symbolInfo: Record<string, unknown>
  resolution: string
  onRealtimeCallback: SubscribeCallback
  onResetCacheNeededCallback?: () => void
  subscribeUID: string
  lastBar: TvBar | null
  isInitialized: boolean
  isBackfilling: boolean
  pendingBars: TvBar[]
  socket: Socket | null // Socket.IO 连接
  channelKey: string
  processIncomingBar: (bar: TvBar) => void
  initialize: () => Promise<void>
}

interface ChannelSubscription {
  symbol: string
  interval: string
  exchange?: string
  socket: Socket
  subscribers: Map<string, Subscription>
  isSubscribed: boolean
}

const SUPPORTED_RESOLUTIONS: TvResolution[] = ['1', '5', '15', '60', '240', '1D']

interface DatafeedContext {
  isAggregated: boolean
  exchange?: string
}

const DEFAULT_DATAFEED_CONTEXT: DatafeedContext = {
  isAggregated: true,
  exchange: 'binance',
}

/**
 * 映射 TradingView resolution 到后端 interval
 */
function resolutionToInterval(resolution: string): string {
  const map: Record<string, string> = {
    '1': '1m',
    '5': '5m',
    '15': '15m',
    '60': '1h',
    '240': '4h',
    '1D': '1d',
  }
  return map[resolution] || '15m'
}

function resolutionToMs(resolution: string): number | null {
  if (resolution === '1D') return 24 * 60 * 60 * 1000
  const minutes = Number(resolution)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return minutes * 60 * 1000
}

function getTickerFromSymbolInfo(symbolInfo: Record<string, unknown>, fallback = 'BTCUSDT'): string {
  if (typeof symbolInfo.ticker === 'string' && symbolInfo.ticker.length > 0) {
    return symbolInfo.ticker
  }
  if (typeof symbolInfo.name === 'string' && symbolInfo.name.length > 0) {
    return symbolInfo.name
  }
  return fallback
}

/**
 * 标准化交易对符号格式
 * @param ticker 原始 ticker（可能包含分隔符，如 "BTC/USDT" 或 "BTC-USDT"）
 * @returns 标准化后的 ticker（如 "BTCUSDT"）
 */
function normalizeSymbol(ticker: string): string {
  // 移除常见分隔符
  const normalized = ticker.replace(/[/\-_]/g, '').toUpperCase()

  // 验证格式（必须以 USDT 或 USDC 结尾）
  if (!normalized.endsWith('USDT') && !normalized.endsWith('USDC')) {
    logger.warn(`Symbol format may be invalid: ${ticker} -> ${normalized}`)
  }

  return normalized
}

export function createMockDatafeed(initialContext: DatafeedContext = DEFAULT_DATAFEED_CONTEXT) {
  let context: DatafeedContext = { ...DEFAULT_DATAFEED_CONTEXT, ...initialContext }
  const subscriptions = new Map<string, Subscription>()
  const channelSubscriptions = new Map<string, ChannelSubscription>()
  const setContext = (next: DatafeedContext) => {
    context = { ...context, ...next }
  }
  const resolveExchange = () => (context.isAggregated ? undefined : context.exchange)
  const unsubscribeBarsInternal = (subscribeUID: string) => {
    logger.debug(`[unsubscribeBars] ${subscribeUID}`)

    const subscription = subscriptions.get(subscribeUID)
    if (subscription) {
      const channel = channelSubscriptions.get(subscription.channelKey)
      if (channel) {
        channel.subscribers.delete(subscribeUID)
        if (channel.subscribers.size === 0) {
          channel.socket.emit('unsubscribe', {
            symbol: channel.symbol,
            interval: channel.interval,
            exchange: channel.exchange,
          })
          channel.socket.disconnect()
          channelSubscriptions.delete(subscription.channelKey)
        }
      }
      subscriptions.delete(subscribeUID)
      logger.debug(`[unsubscribeBars] Unsubscribed successfully`)
    }
  }

  return {
    setContext,
    onReady(cb: OnReadyCallback) {
      // Charting Library 期望异步回调
      setTimeout(() => {
        cb({
          supported_resolutions: SUPPORTED_RESOLUTIONS,
        })
      }, 0)
    },

    // Charting Library 会在符号搜索/对比等场景调用；mock 先返回空列表即可（避免 console 报错刷屏）
    searchSymbols(
      _userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: (items: unknown[]) => void,
    ) {
      setTimeout(() => {
        onResult([])
      }, 0)
    },

    resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: ErrorCallback) {
      try {
        const ticker = symbolName.toUpperCase()
        // TradingView 要求 resolveSymbol 结果必须异步返回（否则会在控制台报错）
        setTimeout(() => {
          onResolve({
            name: ticker,
            ticker,
            description: `${ticker} (mock)`,
            type: 'crypto',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'MOCK',
            listed_exchange: 'MOCK',

            // 价格精度：两位小数（pricescale=100）
            pricescale: 100,
            minmov: 1,

            has_intraday: true,
            has_daily: true,
            has_volume: true,
            supported_resolutions: SUPPORTED_RESOLUTIONS,

            // volume 精度可根据需要调整
            volume_precision: 2,
            data_status: 'streaming',
          })
        }, 0)
      } catch (e) {
        onError((e as Error)?.message || 'resolveSymbol failed')
      }
    },

    async getBars(
      symbolInfo: Record<string, unknown>,
      resolution: string,
      periodParams: PeriodParams,
      onResult: BarsCallback,
      onError: ErrorCallback,
    ) {
      const stepMs = resolutionToMs(resolution)
      if (!stepMs || !SUPPORTED_RESOLUTIONS.includes(resolution as TvResolution)) {
        onError(`Unsupported resolution: ${resolution}`)
        return
      }

      // 尝试获取真实数据
      try {
        // 映射 TradingView resolution -> 后端 interval
        const intervalMap: Record<string, string> = {
          '1': '1m',
          '5': '5m',
          '15': '15m',
          '60': '1h',
          '240': '4h',
          '1D': '1d',
        }
        const interval = intervalMap[resolution]
        if (!interval) {
          throw new Error(`Unsupported resolution: ${resolution}`)
        }

        // 提取 symbol（使用完整的 ticker，如 BTCUSDT）
        const ticker = getTickerFromSymbolInfo(symbolInfo)
        const symbol = normalizeSymbol(ticker) // 标准化格式，移除分隔符

        // 调用真实 API
        const exchange = resolveExchange()
        const bars = await fetchKlineData({
          symbol,
          interval,
          from: periodParams.from,
          to: periodParams.to,
          exchange,
        })

        // 成功获取数据
        if (bars.length > 0) {
          onResult(bars, { noData: false })
          return
        }

        onResult([], { noData: true })
      } catch (e) {
        const message = (e as Error)?.message || 'K线数据获取失败'
        onError(message)
      }
    },

    subscribeBars(
      symbolInfo: Record<string, unknown>,
      resolution: string,
      onRealtimeCallback: SubscribeCallback,
      subscribeUID: string,
      _onResetCacheNeededCallback?: () => void,
    ) {
      logger.debug(`[subscribeBars] ${subscribeUID}`, { symbolInfo, resolution })

      if (subscriptions.has(subscribeUID)) {
        logger.warn(`[subscribeBars] Duplicate subscribeUID detected, replacing: ${subscribeUID}`)
        unsubscribeBarsInternal(subscribeUID)
      }

      // 映射 resolution 到后端 interval
      const interval = resolutionToInterval(resolution)
      if (!interval) {
        logger.error(`[subscribeBars] Unsupported resolution: ${resolution}`)
        return
      }

      // 提取 symbol
      const ticker = getTickerFromSymbolInfo(symbolInfo)
      const symbol = normalizeSymbol(ticker)
      const exchange = resolveExchange()
      const channelKey = `${symbol}:${interval}:${exchange ?? 'all'}`

      // 获取 WebSocket URL（从环境变量或使用默认值）
      const wsBaseUrl = getWsBaseUrl()

      let channel = channelSubscriptions.get(channelKey)
      if (!channel) {
        // 创建 Socket.IO 连接
        const socket = io(`${wsBaseUrl}/kline`, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        })

        channel = {
          symbol,
          interval,
          exchange,
          socket,
          subscribers: new Map<string, Subscription>(),
          isSubscribed: false,
        }
        channelSubscriptions.set(channelKey, channel)

        // 监听连接事件
        socket.on('connect', () => {
          logger.debug(`[subscribeBars] Socket.IO connected, preparing to subscribe ${symbol}:${interval}`)
          channel!.isSubscribed = false
          for (const subscriber of channel!.subscribers.values()) {
            void subscriber.initialize()
          }
        })

        // 监听订阅确认
        socket.on('subscribed', (data: SubscriptionConfirmData) => {
          logger.debug(`[subscribeBars] Subscribed:`, data)
        })

        // 监听实时 K线数据
        socket.on('kline', (data: KlineEventData) => {
          const { bar } = data
          for (const subscriber of channel!.subscribers.values()) {
            subscriber.processIncomingBar(bar)
          }
        })

        // 监听取消订阅确认
        socket.on('unsubscribed', (data: SubscriptionConfirmData) => {
          logger.debug(`[subscribeBars] Unsubscribed:`, data)
        })

        // 监听连接错误
        socket.on('connect_error', (error) => {
          logger.error(`[subscribeBars] Socket.IO connection error:`, error)
        })

        // 监听断开连接
        socket.on('disconnect', (reason) => {
          logger.warn(`[subscribeBars] Socket.IO disconnected:`, reason)
          channel!.isSubscribed = false
        })
      }

      // 创建订阅
      const subscription: Subscription = {
        symbolInfo,
        resolution,
        onRealtimeCallback,
        onResetCacheNeededCallback: _onResetCacheNeededCallback,
        subscribeUID,
        lastBar: null,
        isInitialized: false,
        isBackfilling: false,
        pendingBars: [],
        socket: channel.socket,
        channelKey,
        processIncomingBar: () => {},
        initialize: async () => {},
      }

      const handleRealtimeBar = (bar: TvBar) => {
        // 如果是第一次获取，直接推送
        if (!subscription.lastBar) {
          subscription.lastBar = bar
          onRealtimeCallback(bar)
          logger.debug(`[subscribeBars] New bar:`, bar)
          return
        }

        if (bar.time < subscription.lastBar.time) {
          logger.warn(
            `[subscribeBars] Out-of-order bar ignored:`,
            bar.time,
            'previous:',
            subscription.lastBar.time,
          )
          return
        }

        // 时间戳递增，说明是新的 K线
        if (bar.time > subscription.lastBar.time) {
          subscription.lastBar = bar
          onRealtimeCallback(bar)
          logger.debug(`[subscribeBars] New bar:`, bar)
        } else {
          // 同一根 K线，检查是否有更新
          const hasUpdate =
            subscription.lastBar.close !== bar.close ||
            subscription.lastBar.high !== bar.high ||
            subscription.lastBar.low !== bar.low ||
            subscription.lastBar.volume !== bar.volume

          if (hasUpdate) {
            subscription.lastBar = bar
            onRealtimeCallback(bar)
            logger.debug(`[subscribeBars] Updated bar:`, bar)
          }
        }
      }

      const stepMs = resolutionToMs(resolution)
      if (!stepMs) {
        logger.error(`[subscribeBars] Unsupported resolution: ${resolution}`)
      }

      const pushBackfillBars = (bars: TvBar[]) => {
        const sortedBars = [...bars].sort((a, b) => a.time - b.time)
        sortedBars.forEach((bar) => {
          if (subscription.lastBar && bar.time <= subscription.lastBar.time) {
            return
          }
          handleRealtimeBar(bar)
        })
      }

      function processIncomingBar(bar: TvBar) {
        if (!subscription.isInitialized || subscription.isBackfilling) {
          subscription.pendingBars.push(bar)
          return
        }

        if (subscription.lastBar && stepMs && bar.time > subscription.lastBar.time + stepMs * 1.5) {
          subscription.pendingBars.push(bar)
          void startBackfill(subscription.lastBar.time, bar.time)
          return
        }

        handleRealtimeBar(bar)
      }

      function flushPendingBars() {
        if (subscription.pendingBars.length === 0) return
        const sortedPendingBars = [...subscription.pendingBars].sort((a, b) => a.time - b.time)
        subscription.pendingBars = []
        for (let index = 0; index < sortedPendingBars.length; index += 1) {
          const pendingBar = sortedPendingBars[index]
          processIncomingBar(pendingBar)
          if (subscription.isBackfilling) {
            const remainingBars = sortedPendingBars.slice(index + 1)
            if (remainingBars.length > 0) {
              subscription.pendingBars = subscription.pendingBars.concat(remainingBars)
            }
            break
          }
        }
      }

      async function startBackfill(fromMs: number, toMs: number) {
        if (subscription.isBackfilling) return
        subscription.isBackfilling = true
        try {
          const exchange = resolveExchange()
          const bars = await fetchKlineData({
            symbol,
            interval,
            from: Math.floor(fromMs / 1000),
            to: Math.floor(toMs / 1000),
            exchange,
          })
          pushBackfillBars(bars)
        } catch (error) {
          logger.warn(`[subscribeBars] Backfill failed:`, error)
        } finally {
          subscription.isBackfilling = false
          flushPendingBars()
        }
      }

      const initialize = async () => {
        if (subscription.isInitialized) return
        try {
          if (subscription.lastBar) {
            await startBackfill(subscription.lastBar.time, Date.now())
          } else {
            const nowSec = Math.floor(Date.now() / 1000)
            const exchange = resolveExchange()
            const bars = await fetchKlineData({
              symbol,
              interval,
              from: nowSec - 120,
              to: nowSec,
              exchange,
            })

            if (bars.length > 0) {
              // 按时间排序，取时间最大的 K 线作为 lastBar
              const sortedBars = [...bars].sort((a, b) => a.time - b.time)
              subscription.lastBar = sortedBars[sortedBars.length - 1] ?? null
            } else {
              logger.warn(`[subscribeBars] No latest bars returned, subscribing without lastBar`)
            }
          }
        } catch (error) {
          logger.warn(`[subscribeBars] Failed to prefetch latest bars, subscribing without lastBar:`, error)
        } finally {
          subscription.isInitialized = true
          if (subscription.pendingBars.length > 0) {
            if (!subscription.lastBar) {
              const sortedPendingBars = [...subscription.pendingBars].sort((a, b) => a.time - b.time)
              subscription.lastBar = sortedPendingBars[0] ?? null
              logger.debug(`[subscribeBars] Using first pending bar as lastBar:`, subscription.lastBar)
              subscription.pendingBars = sortedPendingBars.slice(1)
            }
            flushPendingBars()
          }
        }

        if (!channel!.isSubscribed) {
          channel!.isSubscribed = true
          channel!.socket.emit('subscribe', {
            symbol,
            interval,
            exchange,
          })
        }
      }

      subscription.processIncomingBar = processIncomingBar
      subscription.initialize = initialize

      channel.subscribers.set(subscribeUID, subscription)
      subscriptions.set(subscribeUID, subscription)

      if (channel.socket.connected) {
        void initialize()
      }

      logger.debug(`[subscribeBars] Subscribed successfully`)
    },

    unsubscribeBars(subscribeUID: string) {
      unsubscribeBarsInternal(subscribeUID)
    },

    /**
     * 通知所有订阅重置缓存，触发 TradingView 重新请求数据
     * 用于 exchange 切换等场景，需要刷新 K 线数据
     */
    resetCache() {
      subscriptions.forEach((subscription) => {
        if (subscription.onResetCacheNeededCallback) {
          subscription.onResetCacheNeededCallback()
        }
      })
    },
  }
}
