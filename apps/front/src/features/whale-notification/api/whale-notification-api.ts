import type {
  CreateWhaleNotificationRuleInput,
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationInboxItem,
  WhaleNotificationRule,
} from '../types'
import { API_BASE_URL } from '@/lib/api-client'
import { getToken, loadStoredSession } from '@/lib/auth-storage'
import { ApiError } from '@/lib/errors'

const RULES_KEY = 'whale_notification_rules'
const INBOX_KEY = 'whale_notification_inbox'

const endpointCandidates = [
  '/whale-notification',
  '/whale-notifications',
] as const

type RequestOutcome<T> =
  | { kind: 'remote'; data: T | null }
  | { kind: 'fallback' }

function authHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

function hasAuthenticatedSession(): boolean {
  const token = getToken()
  if (!token) return false
  return Boolean(loadStoredSession())
}

function hashString(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function resolveStorageScope(): string {
  const profile = loadStoredSession()?.profile as { id?: string } | undefined
  if (profile?.id) return `uid:${profile.id}`

  const token = getToken()
  if (token) return `tk:${hashString(token).slice(0, 10)}`

  return 'guest'
}

function scopedStorageKey(baseKey: string): string {
  return `${baseKey}:${resolveStorageScope()}`
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback

  if ('error' in payload && payload.error && typeof payload.error === 'object') {
    const errObj = payload.error as { message?: unknown }
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message
    }
  }

  if ('message' in payload && typeof (payload as { message?: unknown }).message === 'string') {
    const message = (payload as { message: string }).message
    if (message.trim()) return message
  }

  return fallback
}

async function requestWithFallback<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<RequestOutcome<T>> {
  let hasFallbackCandidateFailure = false
  let lastFailure: Error | null = null

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

      if (response.ok) {
        if (response.status === 204) {
          return { kind: 'remote', data: null }
        }

        const json = await response.json().catch(() => null)
        if (json && typeof json === 'object' && 'data' in json) {
          return { kind: 'remote', data: (json as { data: T }).data }
        }
        return { kind: 'remote', data: json as T }
      }

      const payload = await response.json().catch(() => null)
      const message = extractErrorMessage(payload, response.statusText || 'Request failed')

      if (response.status === 401) {
        throw new ApiError(message, 'UNAUTHENTICATED', 401, payload)
      }
      if (response.status === 403) {
        throw new ApiError(message, 'FORBIDDEN', 403, payload)
      }

      if (response.status === 404 || response.status === 405) {
        hasFallbackCandidateFailure = true
        lastFailure = new ApiError(message, 'API_ERROR', response.status, payload)
        continue
      }

      if (response.status >= 400 && response.status < 500) {
        throw new ApiError(message, 'API_ERROR', response.status, payload)
      }

      if (response.status >= 500) {
        hasFallbackCandidateFailure = true
        lastFailure = new ApiError(message, 'SERVER_ERROR', response.status, payload)
        continue
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      hasFallbackCandidateFailure = true
      lastFailure = error instanceof Error ? error : new Error(String(error))
    }
  }

  if (hasFallbackCandidateFailure) {
    return { kind: 'fallback' }
  }

  throw lastFailure ?? new ApiError('Request failed', 'API_ERROR')
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
  return safeParse<WhaleNotificationRule[]>(localStorage.getItem(scopedStorageKey(RULES_KEY)), [])
}

function saveRulesToLocal(rules: WhaleNotificationRule[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(scopedStorageKey(RULES_KEY), JSON.stringify(rules))
}

function loadInboxFromLocal(): WhaleNotificationInboxItem[] {
  if (typeof window === 'undefined') return []
  return safeParse<WhaleNotificationInboxItem[]>(localStorage.getItem(scopedStorageKey(INBOX_KEY)), [])
}

function saveInboxToLocal(items: WhaleNotificationInboxItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(scopedStorageKey(INBOX_KEY), JSON.stringify(items))
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
  const outcome = await requestWithFallback<WhaleNotificationRule[]>('GET', '/rules')
  if (outcome.kind === 'remote') return outcome.data ?? []
  return loadRulesFromLocal()
}

export async function createWhaleNotificationRule(
  input: CreateWhaleNotificationRuleInput,
): Promise<WhaleNotificationRule> {
  const outcome = await requestWithFallback<WhaleNotificationRule>('POST', '/rules', input)
  if (outcome.kind === 'remote' && outcome.data) return outcome.data

  if (outcome.kind === 'remote' && !outcome.data) {
    throw new ApiError('Create rule response is empty', 'API_ERROR')
  }

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
  const outcome = await requestWithFallback<WhaleNotificationRule>('PUT', `/rules/${id}`, input)
  if (outcome.kind === 'remote' && outcome.data) return outcome.data

  if (outcome.kind === 'remote' && !outcome.data) {
    throw new ApiError('Update rule response is empty', 'API_ERROR')
  }

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
    throw new ApiError('Rule not found', 'NOT_FOUND', 404)
  }

  return updatedRule
}

export async function deleteWhaleNotificationRule(id: string): Promise<void> {
  const outcome = await requestWithFallback<null>('DELETE', `/rules/${id}`)
  if (outcome.kind === 'remote') return

  const rules = loadRulesFromLocal().filter(rule => rule.id !== id)
  saveRulesToLocal(rules)
}

export async function listWhaleNotificationInbox(): Promise<WhaleNotificationInboxItem[]> {
  if (!hasAuthenticatedSession()) {
    return loadInboxFromLocal()
  }

  const outcome = await requestWithFallback<WhaleNotificationInboxItem[]>('GET', '/notifications')
  if (outcome.kind === 'remote') return outcome.data ?? []
  return loadInboxFromLocal()
}

export async function markWhaleNotificationRead(id: string): Promise<void> {
  const outcome = await requestWithFallback<null>('PATCH', `/notifications/${id}/read`)
  if (outcome.kind === 'remote') return

  const items = loadInboxFromLocal().map((item) => {
    if (item.id !== id) return item
    return { ...item, read: true }
  })
  saveInboxToLocal(items)
}

export async function markAllWhaleNotificationsRead(): Promise<void> {
  const outcome = await requestWithFallback<null>('POST', '/notifications/read-all')
  if (outcome.kind === 'remote') return

  const items = loadInboxFromLocal().map(item => ({ ...item, read: true }))
  saveInboxToLocal(items)
}

export async function getWhaleNotificationUnreadCount(): Promise<number> {
  if (!hasAuthenticatedSession()) {
    const items = loadInboxFromLocal()
    return items.filter(item => !item.read).length
  }

  try {
    const outcome = await requestWithFallback<{ unread: number }>('GET', '/notifications/unread-count')
    if (outcome.kind === 'remote' && outcome.data && typeof outcome.data.unread === 'number') {
      return outcome.data.unread
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error
    }
  }

  try {
    const inbox = await listWhaleNotificationInbox()
    return inbox.filter(item => !item.read).length
  } catch {
    // fall through to local storage fallback below
  }

  const items = loadInboxFromLocal()
  return items.filter(item => !item.read).length
}
