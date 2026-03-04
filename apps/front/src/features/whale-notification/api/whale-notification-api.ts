import type {
  CreateWhaleNotificationRuleInput,
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationInboxItem,
  WhaleNotificationRule,
} from '../types'
import { API_BASE_URL } from '@/lib/api-client'
import { getToken, loadStoredSession } from '@/lib/auth-storage'

const RULES_KEY = 'whale_notification_rules'
const INBOX_KEY = 'whale_notification_inbox'

const endpointCandidates = [
  '/whale-notification',
  '/whale-notifications',
] as const

function authHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function requestWithFallback<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  for (const basePath of endpointCandidates) {
    try {
      const response = await fetch(`${API_BASE_URL}${basePath}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (!response.ok) continue
      if (response.status === 204) return null

      const json = await response.json().catch(() => null)
      if (json && typeof json === 'object' && 'data' in json) {
        return (json as { data: T }).data
      }
      return json as T
    } catch {
      // Try next base path.
    }
  }

  return null
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadRulesFromLocal(): WhaleNotificationRule[] {
  if (typeof window === 'undefined') return []
  return safeParse<WhaleNotificationRule[]>(localStorage.getItem(RULES_KEY), [])
}

function saveRulesToLocal(rules: WhaleNotificationRule[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

function loadInboxFromLocal(): WhaleNotificationInboxItem[] {
  if (typeof window === 'undefined') return []
  return safeParse<WhaleNotificationInboxItem[]>(localStorage.getItem(INBOX_KEY), [])
}

function saveInboxToLocal(items: WhaleNotificationInboxItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INBOX_KEY, JSON.stringify(items))
}

function buildDefaultDelivery(enabled: boolean) {
  return enabled ? 'SENT' : 'SKIPPED'
}

function appendRuleCreatedInboxItem(rule: WhaleNotificationRule): void {
  const now = new Date().toISOString()
  const description =
    rule.type === 'ADDRESS'
      ? `地址 ${rule.address} 已创建大额开单通知规则`
      : `币种 ${rule.symbol} 已创建大额开单通知规则`

  const item: WhaleNotificationInboxItem = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: '监控规则已创建',
    content: description,
    ruleId: rule.id,
    read: false,
    createdAt: now,
    channels: {
      web: buildDefaultDelivery(rule.channels.web),
      email: buildDefaultDelivery(rule.channels.email),
      telegram: buildDefaultDelivery(rule.channels.telegram),
    },
  }

  const current = loadInboxFromLocal()
  saveInboxToLocal([item, ...current])
}

function getDefaultEmailChannelState(): boolean {
  const profile = loadStoredSession()?.profile
  return Boolean(profile?.email)
}

export function getDefaultWhaleChannels() {
  return {
    web: true,
    email: getDefaultEmailChannelState(),
    telegram: false,
  }
}

export async function listWhaleNotificationRules(): Promise<WhaleNotificationRule[]> {
  const remote = await requestWithFallback<WhaleNotificationRule[]>('GET', '/rules')
  if (remote) return remote
  return loadRulesFromLocal()
}

export async function createWhaleNotificationRule(
  input: CreateWhaleNotificationRuleInput,
): Promise<WhaleNotificationRule> {
  const remote = await requestWithFallback<WhaleNotificationRule>('POST', '/rules', input)
  if (remote) return remote

  const now = new Date().toISOString()
  const next: WhaleNotificationRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    address: input.address,
    symbol: input.symbol,
    thresholdUsd: input.thresholdUsd,
    note: input.note,
    channels: input.channels,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  const rules = loadRulesFromLocal()
  saveRulesToLocal([next, ...rules])
  appendRuleCreatedInboxItem(next)
  return next
}

export async function updateWhaleNotificationRule(
  id: string,
  input: UpdateWhaleNotificationRuleInput,
): Promise<WhaleNotificationRule> {
  const remote = await requestWithFallback<WhaleNotificationRule>('PATCH', `/rules/${id}`, input)
  if (remote) return remote

  const rules = loadRulesFromLocal()
  let updatedRule: WhaleNotificationRule | null = null
  const updated = rules.map((rule) => {
    if (rule.id !== id) return rule
    updatedRule = {
      ...rule,
      ...input,
      channels: input.channels ?? rule.channels,
      updatedAt: new Date().toISOString(),
    }
    return updatedRule
  })

  saveRulesToLocal(updated)

  if (!updatedRule) {
    throw new Error('Rule not found')
  }

  return updatedRule
}

export async function deleteWhaleNotificationRule(id: string): Promise<void> {
  const remote = await requestWithFallback<null>('DELETE', `/rules/${id}`)
  if (remote !== null) return

  const rules = loadRulesFromLocal().filter(rule => rule.id !== id)
  saveRulesToLocal(rules)
}

export async function listWhaleNotificationInbox(): Promise<WhaleNotificationInboxItem[]> {
  const remote = await requestWithFallback<WhaleNotificationInboxItem[]>('GET', '/notifications')
  if (remote) return remote
  return loadInboxFromLocal()
}

export async function markWhaleNotificationRead(id: string): Promise<void> {
  const remote = await requestWithFallback<null>('PATCH', `/notifications/${id}/read`)
  if (remote !== null) return

  const items = loadInboxFromLocal().map((item) => {
    if (item.id !== id) return item
    return { ...item, read: true }
  })
  saveInboxToLocal(items)
}

export async function markAllWhaleNotificationsRead(): Promise<void> {
  const remote = await requestWithFallback<null>('PATCH', '/notifications/read-all')
  if (remote !== null) return

  const items = loadInboxFromLocal().map(item => ({ ...item, read: true }))
  saveInboxToLocal(items)
}

export async function getWhaleNotificationUnreadCount(): Promise<number> {
  const remote = await requestWithFallback<{ unread: number }>('GET', '/notifications/unread-count')
  if (remote && typeof remote.unread === 'number') return remote.unread

  const items = loadInboxFromLocal()
  return items.filter(item => !item.read).length
}
