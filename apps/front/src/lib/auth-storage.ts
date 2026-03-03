import type { AuthResponseDto } from '@/types/auth'
import type { AuthSession } from '@/features/auth/types'

const SESSION_KEY = 'auth_session'
const TOKEN_KEY = 'accessToken'

function ensureSessionShape(session: AuthSession): AuthSession {
  if (!Array.isArray(session.loginMethods)) {
    session.loginMethods = []
  }

  return session
}

/**
 * 从 API 响应构建会话对象
 */
export function buildSession(response: AuthResponseDto): AuthSession {
  const expiresIn = 7 * 24 * 60 * 60
  const expiresAt = Date.now() + expiresIn * 1000

  return {
    userId: response.user.id,
    email: response.user.email,
    telegram: null,
    loginMethods: ['email'],
    accessToken: response.accessToken,
    expiresAt,
  }
}

/**
 * 从本地存储加载会话
 */
export function loadStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const session = ensureSessionShape(JSON.parse(raw) as AuthSession)

    if (!session.userId || !session.accessToken || session.expiresAt <= Date.now()) {
      clearStoredSession()
      return null
    }

    return session
  } catch {
    clearStoredSession()
    return null
  }
}

/**
 * 持久化会话到本地存储和 cookies
 * cookies 用于服务端访问（SSR/Server Components）
 */
export function persistSession(session: AuthSession): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(TOKEN_KEY, session.accessToken)

  const maxAge = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000))
  document.cookie = `accessToken=${session.accessToken}; path=/; max-age=${maxAge}; samesite=lax`
}

/**
 * 清除存储的会话（localStorage 和 cookies）
 */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = 'accessToken=; path=/; max-age=0'
}

/**
 * 获取当前访问令牌
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 获取当前用户身份 ID
 */
export function getCurrentUserId(): string | null {
  const session = loadStoredSession()
  return session?.userId ?? null
}
