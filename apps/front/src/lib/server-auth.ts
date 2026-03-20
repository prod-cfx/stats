import { cookies } from 'next/headers'

const TOKEN_COOKIE_NAME = 'accessToken'

/**
 * 在服务端获取认证 token（从 cookies）
 * 用于 Server Components 和 Server Actions
 */
export async function getServerToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(TOKEN_COOKIE_NAME)
    return token?.value || null
  } catch (error) {
    console.error('[server-auth] Failed to get token from cookies:', error)
    return null
  }
}

/**
 * 获取服务端认证 headers
 * 如果存在 token 则返回 Authorization header，否则返回空对象
 * 用于支持匿名访问的接口（如策略列表）
 */
export async function getServerAuthHeaders(): Promise<Record<string, string>> {
  const token = await getServerToken()
  
  if (!token) {
    return {}
  }
  
  // 基本的 JWT 格式验证
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    console.warn('[server-auth] Invalid JWT format')
    return {}
  }
  
  return { Authorization: `Bearer ${token}` }
}
