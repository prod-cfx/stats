'use client'

import { useCallback, useEffect, useState } from 'react'
import { getWhaleNotificationUnreadCount } from '../api/whale-notification-api'

const DEFAULT_INTERVAL_MS = 30_000

export function useWhaleNotificationUnreadCount(intervalMs = DEFAULT_INTERVAL_MS) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const count = await getWhaleNotificationUnreadCount()
      setUnreadCount(count)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const timer = window.setInterval(() => {
      void refresh()
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [refresh, intervalMs])

  return {
    unreadCount,
    loading,
    refresh,
  }
}
