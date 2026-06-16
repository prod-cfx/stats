/**
 * Custom hooks for data fetching with loading and error states
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  immediate?: boolean
}

interface UseAsyncReturn<T> {
  data: T | null
  loading: boolean
  error: Error | null
  execute: () => Promise<void>
  reset: () => void
}

/**
 * Generic async data fetching hook with loading and error states
 * Uses useRef to keep asyncFunction stable and prevent infinite loops
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T> {
  const { onSuccess, onError, immediate = true } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<Error | null>(null)

  // 递增的请求 ID，用于避免并发请求时旧结果覆盖新结果
  const requestIdRef = useRef(0)

  // Use ref to keep the latest asyncFunction without triggering re-renders
  const asyncFunctionRef = useRef(asyncFunction)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  })

  const execute = useCallback(async () => {
    const requestId = ++requestIdRef.current

    setLoading(true)
    setError(null)

    try {
      const result = await asyncFunctionRef.current()

      // 只有当前仍是最新请求时才更新数据，避免旧请求覆盖新结果
      if (requestId !== requestIdRef.current) return

      setData(result)
      onSuccessRef.current?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')

      if (requestId !== requestIdRef.current) return

      setError(error)
      onErrorRef.current?.(error)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, execute])

  return { data, loading, error, execute, reset }
}
