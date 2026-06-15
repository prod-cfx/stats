import { useEffect, useRef } from 'react'

export function useTimeout(callback: () => void, delayMs: number | null) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (delayMs == null) return

    const timeoutId = window.setTimeout(() => callbackRef.current(), delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [delayMs])
}
