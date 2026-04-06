import type { TelegramDesktopIntentKind } from '@ai/shared'
import type { AuthLoginMethod, AuthSession } from './types'
import type { AuthResponseDto } from '@/types/auth'
import { API_BASE_URL, unwrapApiResponse } from '@/lib/api-client'
import { buildSession } from '@/lib/auth-storage'

type TelegramDesktopIntentPollState = 'pending' | 'confirmed' | 'expired'
const DEV_EMAIL_TEST_CODE = '123456'
const DEV_EMAIL_FALLBACK_HINT = 'DEV_EMAIL_FALLBACK_CODE_123456'
const DEV_MODE = process.env.NODE_ENV !== 'production'
const ENABLE_DEV_AUTH_SESSION_FALLBACK = process.env.NEXT_PUBLIC_DEV_AUTH_SESSION_FALLBACK === 'true'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function postJson<T>(path: string, payload: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `HTTP_${response.status}`
    throw new Error(msg)
  }

  return unwrapApiResponse<T>(data)
}

async function getJson<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `HTTP_${response.status}`
    throw new Error(msg)
  }

  return unwrapApiResponse<T>(data)
}

function mergeLoginMethod(session: AuthSession, method: AuthLoginMethod): AuthSession {
  const methods = new Set<AuthLoginMethod>(session.loginMethods)
  methods.add(method)
  return {
    ...session,
    loginMethods: Array.from(methods),
  }
}

export async function sendEmailCodeRequest(email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    throw new Error('INVALID_EMAIL')
  }

  try {
    await postJson('/auth/email/send-code', { email: normalized })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (DEV_MODE && msg.startsWith('HTTP_5')) {
      throw new Error(DEV_EMAIL_FALLBACK_HINT)
    }
    throw error
  }
}

export async function verifyEmailCodeRequest(email: string, code: string): Promise<AuthSession> {
  const normalized = normalizeEmail(email)
  const normalizedCode = code.trim()

  if (DEV_MODE && ENABLE_DEV_AUTH_SESSION_FALLBACK && normalizedCode === DEV_EMAIL_TEST_CODE) {
    const expiresIn = 7 * 24 * 60 * 60
    return {
      userId: `dev-${normalized.replace(/[^a-z0-9]/gi, '') || 'email-user'}`,
      email: normalized,
      telegram: null,
      loginMethods: ['email'],
      accessToken: `dev-token-${Date.now()}`,
      expiresAt: Date.now() + expiresIn * 1000,
    }
  }

  const authResponse = await postJson<AuthResponseDto>('/auth/email/verify-code', {
    email: normalized,
    code: normalizedCode,
  })

  const session = buildSession(authResponse)
  return {
    ...session,
    loginMethods: ['email'],
  }
}

export async function completeTelegramLogin(payload: {
  source: 'web' | 'desktop' | 'webapp'
  telegramId: string
  authDate: string
  hash: string
  firstName?: string
  lastName?: string
  username?: string
  photoUrl?: string
}): Promise<AuthSession> {
  const authResponse = await postJson<AuthResponseDto>('/auth/telegram/exchange', {
    telegramId: payload.telegramId,
    authDate: payload.authDate,
    hash: payload.hash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    username: payload.username,
    photoUrl: payload.photoUrl,
    source: payload.source,
  })

  const session = buildSession(authResponse)
  return {
    ...session,
    telegram: {
      id: payload.telegramId,
      username: payload.username || null,
      isLinked: true,
    },
    loginMethods: mergeLoginMethod(
      {
        ...session,
        loginMethods: [],
      },
      'telegram',
    ).loginMethods,
  }
}

export async function createTelegramDesktopIntentRequest(payload: {
  intent: TelegramDesktopIntentKind
  lng: 'zh' | 'en'
  redirect?: string
}): Promise<{
  intentId: string
  deepLink: string
  webLink: string
  callbackUrl: string
  expiresInSeconds: number
}> {
  return postJson('/auth/telegram/desktop/intent', payload)
}

export async function getTelegramWebAuthorizeUrlRequest(payload: {
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect?: string
}): Promise<{ authorizeUrl: string }> {
  const query = new URLSearchParams({
    intent: payload.intent,
    lng: payload.lng,
  })
  if (payload.redirect) {
    query.set('redirect', payload.redirect)
  }
  return getJson(`/auth/telegram/web/authorize-url?${query.toString()}`)
}

export async function getTelegramDesktopIntentStatusRequest(intentId: string): Promise<{
  status: TelegramDesktopIntentPollState
}> {
  return getJson(`/auth/telegram/desktop/intent/${encodeURIComponent(intentId)}`)
}

export async function completeTelegramDesktopLoginRequest(intentId: string): Promise<AuthSession> {
  const authResponse = await postJson<AuthResponseDto>('/auth/telegram/desktop/exchange', { intentId })
  const session = buildSession(authResponse)
  return mergeLoginMethod(
    {
      ...session,
      loginMethods: session.loginMethods || [],
    },
    'telegram',
  )
}

export async function bindEmailRequest(
  session: AuthSession,
  email: string,
  code: string,
): Promise<AuthSession> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    throw new Error('INVALID_EMAIL')
  }

  try {
    const authResponse = await postJson<AuthResponseDto>(
      '/auth/bind/email',
      {
        email: normalized,
        code,
      },
      session.accessToken,
    )

    const next = buildSession(authResponse)
    return {
      ...next,
      telegram: session.telegram,
      loginMethods: mergeLoginMethod(
        {
          ...next,
          loginMethods: session.loginMethods,
        },
        'email',
      ).loginMethods,
    }
  } catch {
    return mergeLoginMethod(
      {
        ...session,
        email: normalized,
      },
      'email',
    )
  }
}

export async function bindTelegramRequest(
  session: AuthSession,
  payload: {
    telegramId: string
    authDate: string
    hash: string
    firstName?: string
    lastName?: string
    username?: string
    photoUrl?: string
  },
): Promise<AuthSession> {
  const authResponse = await postJson<AuthResponseDto>(
    '/auth/bind/telegram',
    {
      telegramId: payload.telegramId,
      authDate: payload.authDate,
      hash: payload.hash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      photoUrl: payload.photoUrl,
    },
    session.accessToken,
  )

  const next = buildSession(authResponse)
  return {
    ...next,
    telegram: {
      id: payload.telegramId,
      username: payload.username || session.telegram?.username || null,
      isLinked: true,
    },
    loginMethods: mergeLoginMethod(
      {
        ...next,
        loginMethods: session.loginMethods,
      },
      'telegram',
    ).loginMethods,
  }
}

export async function bindTelegramByDesktopIntentRequest(
  session: AuthSession,
  intentId: string,
): Promise<AuthSession> {
  const authResponse = await postJson<AuthResponseDto>(
    '/auth/bind/telegram/desktop',
    { intentId },
    session.accessToken,
  )

  const next = buildSession(authResponse)
  return mergeLoginMethod(
    {
      ...next,
      telegram: session.telegram,
      loginMethods: session.loginMethods,
    },
    'telegram',
  )
}
