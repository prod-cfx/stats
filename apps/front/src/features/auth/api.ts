import type { TelegramDesktopIntentKind } from '@ai/shared'
import type { AuthLoginMethod, AuthSession } from './types'
import type { AuthResponseDto } from '@/types/auth'
import { client, unwrapApiResponse } from '@/lib/api-client'
import { buildSession } from '@/lib/auth-storage'

type TelegramDesktopIntentPollState = 'pending' | 'confirmed' | 'expired'
const DEV_EMAIL_TEST_CODE = '123456'
const DEV_EMAIL_FALLBACK_HINT = 'DEV_EMAIL_FALLBACK_CODE_123456'
const DEV_MODE = process.env.NODE_ENV !== 'production'
const ENABLE_DEV_AUTH_SESSION_FALLBACK = process.env.NEXT_PUBLIC_DEV_AUTH_SESSION_FALLBACK === 'true'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeBetaCode(betaCode?: string) {
  return betaCode?.trim() || undefined
}

function authHeader(token?: string): { Authorization?: string } {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function callClient<T>(operation: () => Promise<unknown>): Promise<T> {
  try {
    const response = await operation()
    return unwrapApiResponse<T>(response as T | { data?: T; message?: string })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object'
    ) {
      const response = error.response as {
        status?: number
        data?: { error?: { message?: unknown }; message?: unknown }
      }
      const message =
        typeof response.data?.error?.message === 'string'
          ? response.data.error.message
          : typeof response.data?.message === 'string'
            ? response.data.message
            : typeof response.status === 'number'
              ? `HTTP_${response.status}`
              : undefined
      if (message?.trim()) {
        throw new Error(message)
      }
    }
    const message = error instanceof Error && error.message.trim() ? error.message : 'API_ERROR'
    throw new Error(message)
  }
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
    await callClient<void>(() => client.AuthController_sendEmailLoginCode({ email: normalized }))
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (DEV_MODE && msg.startsWith('HTTP_5')) {
      throw new Error(DEV_EMAIL_FALLBACK_HINT)
    }
    throw error
  }
}

export async function verifyEmailCodeRequest(email: string, code: string, betaCode?: string): Promise<AuthSession> {
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

  const authResponse = await callClient<AuthResponseDto>(() =>
    client.AuthController_verifyEmailLoginCode({
      email: normalized,
      code: normalizedCode,
      betaCode: normalizeBetaCode(betaCode),
    }),
  )

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
  betaCode?: string
}): Promise<AuthSession> {
  const authResponse = await callClient<AuthResponseDto>(() =>
    client.AuthController_telegramExchange({
      telegramId: payload.telegramId,
      authDate: payload.authDate,
      hash: payload.hash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      photoUrl: payload.photoUrl,
      source: payload.source,
      betaCode: normalizeBetaCode(payload.betaCode),
    }),
  )

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
  return callClient(() => client.AuthController_createTelegramDesktopIntent(payload))
}

export async function getTelegramWebAuthorizeUrlRequest(payload: {
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect?: string
}): Promise<{ authorizeUrl: string }> {
  return callClient(() =>
    client.AuthController_getTelegramWebAuthorizeUrl({
      queries: {
        intent: payload.intent,
        lng: payload.lng,
        ...(payload.redirect ? { redirect: payload.redirect } : {}),
      } as any,
    }),
  )
}

export async function getTelegramDesktopIntentStatusRequest(intentId: string): Promise<{
  status: TelegramDesktopIntentPollState
}> {
  return callClient(() =>
    client.AuthController_getTelegramDesktopIntentStatus({
      params: { intentId },
    }),
  )
}

export async function getTelegramLoginConfigRequest(): Promise<{
  botName?: string | null
  betaCodeGateEnabled?: boolean
}> {
  return callClient(() => client.AuthController_getTelegramLoginConfig())
}

export async function completeTelegramDesktopLoginRequest(intentId: string, betaCode?: string): Promise<AuthSession> {
  const authResponse = await callClient<AuthResponseDto>(() =>
    client.AuthController_telegramDesktopExchange({ intentId, betaCode: normalizeBetaCode(betaCode) }),
  )
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
    const authResponse = await callClient<AuthResponseDto>(() =>
      client.AuthController_bindEmail(
        {
          email: normalized,
          code,
        },
        {
          headers: authHeader(session.accessToken),
        },
      ),
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
  const authResponse = await callClient<AuthResponseDto>(() =>
    client.AuthController_bindTelegram(
      {
        telegramId: payload.telegramId,
        authDate: payload.authDate,
        hash: payload.hash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username,
        photoUrl: payload.photoUrl,
      },
      {
        headers: authHeader(session.accessToken),
      },
    ),
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
  const authResponse = await callClient<AuthResponseDto>(() =>
    client.AuthController_bindTelegramByDesktopIntent(
      { intentId },
      {
        headers: authHeader(session.accessToken),
      },
    ),
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
