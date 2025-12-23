import type { AuthResponseDto, UserProfile } from '@/types/auth'

const SESSION_KEY = 'auth_session'
const TOKEN_KEY = 'accessToken'

export interface AuthSession {
  profile: UserProfile
  token: {
    accessToken: string
    expiresIn: number
  }
  expiresAt: number
  hasLinkedAccount?: boolean
}

/**
 * 从 API 响应构建会话对象
 */
export function buildSession(response: AuthResponseDto): AuthSession {
  // 假设 token 有效期为 7 天（如果没有 expiresIn 字段）
  const expiresIn = 7 * 24 * 60 * 60
  const expiresAt = Date.now() + expiresIn * 1000

  return {
    profile: response.user,
    token: {
      accessToken: response.accessToken,
      expiresIn,
    },
    expiresAt,
    hasLinkedAccount: false,
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

    const session: AuthSession = JSON.parse(raw)

    // 检查会话是否已过期
    if (session.expiresAt <= Date.now()) {
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
  
  // 存储到 localStorage（客户端访问）
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(TOKEN_KEY, session.token.accessToken)
  
  // 同时存储到 cookies（服务端访问）
  // 设置 7 天过期，与 session 的 expiresIn 保持一致
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  document.cookie = `accessToken=${session.token.accessToken}; path=/; max-age=${maxAge}; samesite=lax`
}

/**
 * 清除存储的会话（localStorage 和 cookies）
 */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return
  
  // 清除 localStorage
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(TOKEN_KEY)
  
  // 清除 cookies（设置过期时间为过去）
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
 * 获取当前用户资料
 */
export function getCurrentUser(): UserProfile | null {
  const session = loadStoredSession()
  return session?.profile ?? null
}
