import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchKlineData } from '@/lib/api'
import { logger } from '@/utils/logger'
import { useInterval } from './useInterval'
import { useTimeout } from './useTimeout'

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
  const stateKey = `${symbol}:${interval}`
  const [dataState, setDataState] = useState<{ key: string, data: AggregatedVolumeBar[] }>(() => ({
    key: stateKey,
    data: [],
  }))
  const [loading, setLoading] = useState(false)
  const [errorState, setErrorState] = useState<{ key: string, error: Error | null }>(() => ({
    key: stateKey,
    error: null,
  }))
  const [retryDelayMs, setRetryDelayMs] = useState<number | null>(null)
  const dataMapRef = useRef<Map<number, number>>(new Map())
  const retryCountRef = useRef(0)
  const lastFetchTimeRef = useRef<number>(0)
  const inFlightKeyRef = useRef<string | null>(null)
  const stateKeyRef = useRef(stateKey)
  const MAX_RETRIES = 3

  const resetForKey = useCallback((nextKey: string) => {
    if (stateKeyRef.current === nextKey) return
    stateKeyRef.current = nextKey
    dataMapRef.current.clear()
    lastFetchTimeRef.current = 0
    retryCountRef.current = 0
    setRetryDelayMs(null)
  }, [])

  const fetchData = useCallback(async (isRetry = false) => {
    if (!enabled || !symbol || !interval) return

    const requestKey = stateKey
    resetForKey(requestKey)
    if (inFlightKeyRef.current === requestKey) return
    if (retryDelayMs != null && !isRetry) return

    try {
      inFlightKeyRef.current = requestKey
      setLoading(true)
      setErrorState({ key: requestKey, error: null })
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

        if (stateKeyRef.current !== requestKey) return

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

      setDataState({ key: requestKey, data: volumeData })
      lastFetchTimeRef.current = now // 更新最后获取时间
      retryCountRef.current = 0 // 成功后重置重试计数
      setRetryDelayMs(null)
    } catch (err) {
      const fetchError = err as Error
      logger.error('[useAggregatedVolumeData] Failed to fetch data', fetchError)

      if (stateKeyRef.current !== requestKey) return

        // 重试逻辑（指数退避）
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++
          const retryDelay = 1000 * 2 ** (retryCountRef.current - 1) // 1s, 2s, 4s
          logger.warn('[useAggregatedVolumeData] Retrying...', {
            attempt: retryCountRef.current,
            maxRetries: MAX_RETRIES,
            delayMs: retryDelay,
          })
        setRetryDelayMs(retryDelay)
      } else {
        setErrorState({ key: requestKey, error: fetchError })
        logger.error('[useAggregatedVolumeData] Max retries reached', {
          maxRetries: MAX_RETRIES,
        })
      }
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null
        setLoading(false)
      }
    }
  }, [enabled, interval, resetForKey, retryDelayMs, stateKey, symbol])

  useEffect(() => {
    if (!enabled || !symbol || !interval) return
    void fetchData()
  }, [enabled, fetchData, interval, symbol])

  useInterval(() => {
    void fetchData()
  }, enabled && symbol && interval ? 3 * 60 * 1000 : null)

  useTimeout(() => {
    setRetryDelayMs(null)
    void fetchData(true)
  }, retryDelayMs)

  const data = dataState.key === stateKey ? dataState.data : []
  const error = errorState.key === stateKey ? errorState.error : null

  const result = useMemo(() => ({ data, loading, error, dataMapRef }), [data, error, loading])

  return result
}
