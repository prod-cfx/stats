import type {
  CreateWhaleNotificationRuleInput,
  UpdateWhaleNotificationRuleInput,
  WhaleNotificationInboxItem,
  WhaleNotificationRule,
} from '../types'
import { client, unwrapApiResponse } from '@/lib/api-client'
import { getToken, loadStoredSession } from '@/lib/auth-storage'
import { ApiError } from '@/lib/errors'

const RULES_KEY = 'whale_notification_rules'
const INBOX_KEY = 'whale_notification_inbox'

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
  const session = loadStoredSession()
  if (session?.userId) return `uid:${session.userId}`

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

function getErrorStatusCode(error: unknown): number | undefined {
  if (error instanceof ApiError && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof (error.response as { status?: unknown }).status === 'number'
  ) {
    return (error.response as { status: number }).status
  }

  return undefined
}

async function requestWithFallback<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<RequestOutcome<T>> {
  try {
    const whaleClient = client as any
    const headers = authHeaders()
    const options = Object.keys(headers).length > 0 ? { headers } : undefined

    let response: unknown
    if (method === 'GET' && path === '/rules') {
      response = await whaleClient.WhaleNotificationRulesController_list(options)
    } else if (method === 'POST' && path === '/rules') {
      response = await whaleClient.WhaleNotificationRulesController_create(body, options)
    } else if (method === 'PUT' && path.startsWith('/rules/')) {
      const id = path.slice('/rules/'.length)
      response = await whaleClient.WhaleNotificationRulesController_update(
        body,
        { ...(options ?? {}), params: { id } },
      )
    } else if (method === 'DELETE' && path.startsWith('/rules/')) {
      const id = path.slice('/rules/'.length)
      response = await whaleClient.WhaleNotificationRulesController_delete(undefined, {
        ...(options ?? {}),
        params: { id },
      })
    } else if (method === 'GET' && path === '/notifications') {
      response = await whaleClient.WhaleNotificationInboxController_list(options)
    } else if (method === 'PATCH' && path.startsWith('/notifications/') && path.endsWith('/read')) {
      const id = path.slice('/notifications/'.length, -'/read'.length)
      response = await whaleClient.WhaleNotificationInboxController_markRead(undefined, {
        ...(options ?? {}),
        params: { id },
      })
    } else if (method === 'POST' && path === '/notifications/read-all') {
      response = await whaleClient.WhaleNotificationInboxController_markAllRead(undefined, options)
    } else if (method === 'GET' && path === '/notifications/unread-count') {
      response = await whaleClient.WhaleNotificationInboxController_unreadCount(options)
    } else {
      return { kind: 'fallback' }
    }

    return {
      kind: 'remote',
      data: unwrapApiResponse<T | null>(response as T | { data?: T | null; message?: string }),
    }
  } catch (error) {
    const statusCode = getErrorStatusCode(error)
    if (statusCode === 401 || statusCode === 403) {
      const message = extractErrorMessage(
        error instanceof ApiError ? error.details : null,
        error instanceof Error ? error.message : 'Request failed',
      )
      throw new ApiError(message, statusCode === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN', statusCode)
    }

    if (error instanceof Error) {
      const message = extractErrorMessage(
        error instanceof ApiError ? error.details : null,
        error.message || 'Request failed',
      )

      if (statusCode === 404 || statusCode === 405 || (typeof statusCode === 'number' && statusCode >= 500)) {
        return { kind: 'fallback' }
      }

      if (error instanceof ApiError) {
        throw new ApiError(message, error.code, statusCode, error.details)
      }
      return { kind: 'fallback' }
    }

    return { kind: 'fallback' }
  }
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
  const session = loadStoredSession()
  return Boolean(session?.email)
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
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      throw error
    }

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
