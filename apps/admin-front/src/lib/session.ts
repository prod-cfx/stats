export interface AdminSession {
  accessToken: string
  admin: {
    id: string
    username: string
    email?: string | null
    nickName?: string | null
    menuPermissions: string[]
  }
}

const TOKEN_KEY = 'admin.accessToken'
const ADMIN_KEY = 'admin.profile'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function storeSession(session: AdminSession) {
  if (!isBrowser()) return
  window.localStorage.setItem(TOKEN_KEY, session.accessToken)
  window.localStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin))
}

export function clearStoredSession() {
  if (!isBrowser()) return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(ADMIN_KEY)
}

export function getSession(): AdminSession | null {
  if (!isBrowser()) return null
  const token = window.localStorage.getItem(TOKEN_KEY)
  const admin = window.localStorage.getItem(ADMIN_KEY)
  if (!token || !admin) return null
  try {
    const parsed = JSON.parse(admin)
    return {
      accessToken: token,
      admin: {
        ...parsed,
        menuPermissions: Array.isArray(parsed.menuPermissions) ? parsed.menuPermissions : [],
      },
    }
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (!isBrowser()) return null
  return window.localStorage.getItem(TOKEN_KEY)
}
