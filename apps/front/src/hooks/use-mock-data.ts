import type { MockOptions } from '@/types/view-state'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { useViewState } from './use-view-state'

export function useMockData<T>(
  fetcher: () => Promise<T>,
  dependencies: unknown[] = [],
  options: MockOptions = {},
) {
  const { data, loading, error, setData, setLoading, setError } = useViewState<T>()
  const searchParams = useSearchParams()
  const requestIdRef = useRef(0)
  const fetcherRef = useRef(fetcher)
  const searchParamsRef = useRef(searchParams)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    searchParamsRef.current = searchParams
  }, [searchParams])

  const load = useCallback(
    async (isTransition = false) => {
      // Determine delay based on rules:
      // Initial: 1200-2000ms, Transition: 600-1000ms
      const delay = options.delay ?? (isTransition ? 800 : 1500)

      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(false)

      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, delay))

        // Global debug overrides via URL（可通过 options.ignoreQueryOverrides 禁用）
        const shouldUseQueryOverrides = !options.ignoreQueryOverrides
        const forceError =
          (shouldUseQueryOverrides && searchParamsRef.current?.get('mock_error') === '1') ||
          options.shouldError
        const forceEmpty =
          (shouldUseQueryOverrides && searchParamsRef.current?.get('mock_empty') === '1') ||
          options.isEmpty

        if (forceError) {
          throw new Error('数据加载失败（Mock）')
        }

        if (forceEmpty) {
          if (requestId === requestIdRef.current) {
            setData(null)
          }
        } else {
          const result = await fetcherRef.current()
          if (requestId === requestIdRef.current) {
            setData(result)
          }
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setError(true)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [
      options.delay,
      options.shouldError,
      options.isEmpty,
      options.ignoreQueryOverrides,
      setData,
      setError,
      setLoading,
    ],
  )

  useEffect(() => {
    void load()
  }, [...dependencies, load])

  const reload = useCallback(() => load(true), [load])

  return { data, loading, error, reload }
}
