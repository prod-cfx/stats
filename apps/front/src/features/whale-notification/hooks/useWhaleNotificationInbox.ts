'use client'

import type { WhaleNotificationInboxItem } from '../types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listWhaleNotificationInbox,
  markAllWhaleNotificationsRead,
  markWhaleNotificationRead,
} from '../api/whale-notification-api'

export function useWhaleNotificationInbox() {
  const [items, setItems] = useState<WhaleNotificationInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await listWhaleNotificationInbox()
      setItems(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const unreadCount = useMemo(() => items.filter(item => !item.read).length, [items])

  const markRead = useCallback(async (id: string) => {
    await markWhaleNotificationRead(id)
    setItems(prev => prev.map(item => (item.id === id ? { ...item, read: true } : item)))
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllWhaleNotificationsRead()
    setItems(prev => prev.map(item => ({ ...item, read: true })))
  }, [])

  return {
    items,
    loading,
    error,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
  }
}
