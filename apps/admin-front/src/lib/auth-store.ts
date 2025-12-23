import type { AdminSession } from './session'

import { create } from 'zustand'
import { clearStoredSession, getSession, storeSession } from './session'

interface AuthState {
  session: AdminSession | null
  initializing: boolean
  setSession: (session: AdminSession) => void
  clearSession: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  initializing: true,
  setSession: session => {
    storeSession(session)
    set({ session })
  },
  clearSession: () => {
    clearStoredSession()
    set({ session: null })
  },
  hydrate: () => {
    const existing = getSession()
    set({ session: existing, initializing: false })
  },
}))
