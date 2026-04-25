/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
import { useEffect, useRef, useState } from 'react'
import { fetchKlineData } from '@/lib/api'
import { logger } from '@/utils/logger'

export interface AggregatedVolumeBar {
  time: number
  volume: number
}

export interface UseAggregatedVolumeDataOptions {
  symbol: string
  interval: string
  enabled?: boolean
}

/**
 * 聚合成交量数据 Hook
 *
 * 单独调用 K 线 API 的聚合模式（exchange='All'），获取多交易所聚合的成交量数据
 * 与 K 线图表的数据源完全独立
 */
export function useAggregatedVolumeData(options: UseAggregatedVolumeDataOptions) {
  const { symbol, interval, enabled = true } = options
  const [data, setData] = useState<AggregatedVolumeBar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const dataMapRef = useRef<Map<number, number>>(new Map())
  const retryCountRef = useRef(0)
  const lastFetchTimeRef = useRef<number>(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const MAX_RETRIES = 3

  // P1-1: 当 symbol/interval 变化时重置状态，避免混入旧数据
  useEffect(() => {
    dataMapRef.current.clear()
    lastFetchTimeRef.current = 0
    retryCountRef.current = 0
     
    setData([])
     
    setError(null)
  }, [symbol, interval])

  useEffect(() => {
    if (!enabled || !symbol || !interval) {
      return
    }

    // P2-1: 使用 isActive 标记防止卸载后 setState
    let isActive = true

    const fetchData = async (isRetry = false) => {
      if (!isActive) return
      if (inFlightRef.current) return
      if (retryTimerRef.current && !isRetry) return

      try {
        inFlightRef.current = true
        setLoading(true)
        setError(null)
        const now = Math.floor(Date.now() / 1000)

        // 增量更新：首次加载获取 24 小时数据，后续只获取新数据
        const from = lastFetchTimeRef.current || now - 24 * 60 * 60

        logger.debug('[useAggregatedVolumeData] Fetching aggregated volume data', {
          symbol,
          interval,
          from,
          to: now,
          isIncremental: lastFetchTimeRef.current > 0,
        })

        // 调用 K 线 API 的聚合模式（不传 exchange 参数，后端会聚合所有交易所）
        const bars = await fetchKlineData({
          symbol,
          interval,
          from,
          to: now,
          // 不传 exchange 参数，后端会返回聚合数据
        })

        logger.debug('[useAggregatedVolumeData] Received bars', { count: bars.length })

        // 清理超过 24 小时的旧数据（防止内存泄漏）
        const cutoffTime = (now - 24 * 60 * 60) * 1000
        const keysToDelete: number[] = []
        for (const [time] of dataMapRef.current.entries()) {
          if (time < cutoffTime) {
            keysToDelete.push(time)
          }
        }
        keysToDelete.forEach(time => {
          dataMapRef.current.delete(time)
        })

        // 更新数据映射（时间戳 -> 成交量）
        bars.forEach(bar => {
          dataMapRef.current.set(bar.time, bar.volume)
        })

        // 转换为数组
        const volumeData = Array.from(dataMapRef.current.entries())
          .map(([time, volume]) => ({ time, volume }))
          .sort((a, b) => a.time - b.time)

        if (!isActive) return
        setData(volumeData)
        lastFetchTimeRef.current = now // 更新最后获取时间
        retryCountRef.current = 0 // 成功后重置重试计数
      } catch (err) {
        if (!isActive) return
        const fetchError = err as Error
        logger.error('[useAggregatedVolumeData] Failed to fetch data', fetchError)

        // 重试逻辑（指数退避）
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++
          const retryDelay = 1000 * 2 ** (retryCountRef.current - 1) // 1s, 2s, 4s
          logger.warn('[useAggregatedVolumeData] Retrying...', {
            attempt: retryCountRef.current,
            maxRetries: MAX_RETRIES,
            delayMs: retryDelay,
          })
          // P2-1: 记录 timer id 以便清理
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            void fetchData(true)
          }, retryDelay)
        } else {
          setError(fetchError)
          logger.error('[useAggregatedVolumeData] Max retries reached', {
            maxRetries: MAX_RETRIES,
          })
        }
      } finally {
        inFlightRef.current = false
        if (isActive) {
          setLoading(false)
        }
      }
    }

    // 立即执行一次
    void fetchData()

    // 每3分钟更新一次
    const intervalId = setInterval(
      () => {
        void fetchData()
      },
      3 * 60 * 1000,
    )

    return () => {
      isActive = false
      clearInterval(intervalId)
      // P2-1: 清理重试定时器
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [symbol, interval, enabled])

  return { data, loading, error, dataMapRef }
}
