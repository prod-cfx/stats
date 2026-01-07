'use client'

import { useCallback, useEffect, useState } from 'react'

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const existing = safeParse<T>(window.localStorage.getItem(key))
    if (existing !== undefined) {
      setValue(existing)
    }
    setHydrated(true)
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(v))
        } catch {
          // ignore quota/serialization errors
        }
        return v
      })
    },
    [key],
  )

  return { value, setValue: update, hydrated }
}


