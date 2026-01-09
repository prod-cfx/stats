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

/**
 * Hook for data fetching with automatic retry on error
 */
export function useAsyncWithRetry<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> & { maxRetries?: number; retryDelay?: number } = {}
): UseAsyncReturn<T> & { retryCount: number } {
  const { maxRetries = 3, retryDelay = 1000, ...asyncOptions } = options
  const [retryCount, setRetryCount] = useState(0)

  // Wrap asyncFunction with retry logic
  const wrappedAsyncFunction = useCallback(async () => {
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        if (attempt > 0) {
          setRetryCount(attempt)
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        }
        const result = await asyncFunction()
        setRetryCount(0)
        return result
      } catch (err) {
        lastError = err
      }
    }

    throw (lastError instanceof Error ? lastError : new Error('Unknown error'))
  }, [asyncFunction, maxRetries, retryDelay])

  const asyncResult = useAsync(wrappedAsyncFunction, asyncOptions)

  return {
    ...asyncResult,
    retryCount,
  }
}

/**
 * Hook for paginated data fetching
 */
interface UsePaginationOptions<T> {
  initialPage?: number
  initialLimit?: number
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export function usePagination<T>(
  fetchFunction: (page: number, limit: number) => Promise<T>,
  options: UsePaginationOptions<T> = {}
) {
  const { initialPage = 1, initialLimit = 20, onSuccess, onError } = options

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  const { data, loading, error, execute } = useAsync(
    () => fetchFunction(page, limit),
    { onSuccess, onError, immediate: false }
  )

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const nextPage = useCallback(() => {
    setPage(p => p + 1)
  }, [])

  const prevPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1))
  }, [])

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when limit changes
  }, [])

  // Refetch when page or limit changes
  useEffect(() => {
    execute()
  }, [page, limit, execute])

  return {
    data,
    loading,
    error,
    page,
    limit,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
    refetch: execute,
  }
}

/**
 * Hook for polling/auto-refresh data
 */
export function usePolling<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> & { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 5000, enabled = true, ...asyncOptions } = options

  const asyncResult = useAsync(asyncFunction, asyncOptions)

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      asyncResult.execute()
    }, interval)

    return () => clearInterval(timer)
  }, [enabled, interval, asyncResult])

  return asyncResult
}

/**
 * Hook for mutation operations (create, update, delete)
 */
export function useMutation<TData, TVariables = void>(
  mutationFunction: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void
    onError?: (error: Error, variables: TVariables) => void
  } = {}
) {
  const [data, setData] = useState<TData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(
    async (variables: TVariables) => {
      setLoading(true)
      setError(null)

      try {
        const result = await mutationFunction(variables)
        setData(result)
        options.onSuccess?.(result, variables)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Mutation failed')
        setError(error)
        options.onError?.(error, variables)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [mutationFunction, options]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    data,
    loading,
    error,
    mutate,
    reset,
  }
}
