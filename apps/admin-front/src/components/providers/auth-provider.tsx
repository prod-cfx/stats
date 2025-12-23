'use client'

import type { AdminSession } from '@/lib/session'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/auth-store'

interface AuthContextValue {
  session: AdminSession | null
  initializing: boolean
  login: (session: AdminSession) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useAuthStore(state => state.session)
  const initializing = useAuthStore(state => state.initializing)
  const setSession = useAuthStore(state => state.setSession)
  const clearSession = useAuthStore(state => state.clearSession)
  const hydrate = useAuthStore(state => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    initializing,
    login: setSession,
    logout: () => clearSession(),
  }), [session, initializing, setSession, clearSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- 同文件需导出自定义 Hook 供组件消费
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 中使用')
  }
  return context
}
