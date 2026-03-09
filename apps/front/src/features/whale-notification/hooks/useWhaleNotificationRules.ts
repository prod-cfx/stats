'use client'

import type {
  CreateWhaleNotificationRuleInput,
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationRule,
} from '../types'
import { useCallback, useEffect, useState } from 'react'
import {
  createWhaleNotificationRule,
  deleteWhaleNotificationRule,
  listWhaleNotificationRules,
  updateWhaleNotificationRule,
} from '../api/whale-notification-api'

export function useWhaleNotificationRules() {
  const [rules, setRules] = useState<WhaleNotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextRules = await listWhaleNotificationRules()
      setRules(nextRules)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createRule = useCallback(async (input: CreateWhaleNotificationRuleInput) => {
    const next = await createWhaleNotificationRule(input)
    setRules(prev => [next, ...prev])
    return next
  }, [])

  const updateRule = useCallback(async (id: string, input: UpdateWhaleNotificationRuleInput) => {
    const next = await updateWhaleNotificationRule(id, input)
    setRules(prev => prev.map(rule => (rule.id === id ? next : rule)))
    return next
  }, [])

  const deleteRule = useCallback(async (id: string) => {
    await deleteWhaleNotificationRule(id)
    setRules(prev => prev.filter(rule => rule.id !== id))
  }, [])

  return {
    rules,
    loading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
  }
}
