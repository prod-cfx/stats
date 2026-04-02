'use client'

import type { ReactNode } from 'react'
import type { AuthContextValue, AuthSession } from './types'
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { clearStoredSession, loadStoredSession, persistSession } from '@/lib/auth-storage'
import {
  bindEmailRequest,
  bindTelegramByDesktopIntentRequest,
  bindTelegramRequest,
  completeTelegramDesktopLoginRequest,
  completeTelegramLogin,
  createTelegramDesktopIntentRequest,
  getTelegramDesktopIntentStatusRequest,
  sendEmailCodeRequest,
  verifyEmailCodeRequest,
} from './api'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSession(loadStoredSession())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'auth_session' || event.key === 'accessToken') {
        setSession(loadStoredSession())
      }
    }

    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const saveSession = useCallback((nextSession: AuthSession) => {
    persistSession(nextSession)
    setSession(nextSession)
  }, [])

  const sendEmailCode = useCallback(async (email: string) => {
    await sendEmailCodeRequest(email)
  }, [])

  const loginWithEmailCode = useCallback(
    async (email: string, code: string) => {
      const nextSession = await verifyEmailCodeRequest(email, code)
      saveSession(nextSession)
    },
    [saveSession],
  )

  const loginWithTelegramCallback = useCallback(
    async (payload: {
      source: 'web' | 'desktop' | 'webapp'
      telegramId: string
      authDate: string
      hash: string
      firstName?: string
      lastName?: string
      username?: string
      photoUrl?: string
    }) => {
      const nextSession = await completeTelegramLogin(payload)
      saveSession(nextSession)
    },
    [saveSession],
  )

  const createTelegramDesktopIntent = useCallback(async (payload: {
    intent: 'login' | 'bind'
    lng: 'zh' | 'en'
    redirect?: string
  }) => {
    return createTelegramDesktopIntentRequest(payload)
  }, [])

  const getTelegramDesktopIntentStatus = useCallback(async (intentId: string) => {
    return getTelegramDesktopIntentStatusRequest(intentId)
  }, [])

  const loginWithTelegramDesktopIntent = useCallback(
    async (intentId: string) => {
      const nextSession = await completeTelegramDesktopLoginRequest(intentId)
      saveSession(nextSession)
    },
    [saveSession],
  )

  const bindEmail = useCallback(
    async (email: string, code: string) => {
      if (!session) throw new Error('UNAUTHENTICATED')
      const nextSession = await bindEmailRequest(session, email, code)
      saveSession(nextSession)
    },
    [saveSession, session],
  )

  const bindTelegram = useCallback(async (payload: {
    telegramId: string
    authDate: string
    hash: string
    firstName?: string
    lastName?: string
    username?: string
    photoUrl?: string
  }) => {
    if (!session) throw new Error('UNAUTHENTICATED')
    const nextSession = await bindTelegramRequest(session, payload)
    saveSession(nextSession)
  }, [saveSession, session])

  const bindTelegramByDesktopIntent = useCallback(async (intentId: string) => {
    if (!session) throw new Error('UNAUTHENTICATED')
    const nextSession = await bindTelegramByDesktopIntentRequest(session, intentId)
    saveSession(nextSession)
  }, [saveSession, session])

  const logout = useCallback(() => {
    clearStoredSession()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isLoading,
      sendEmailCode,
      loginWithEmailCode,
      loginWithTelegramCallback,
      createTelegramDesktopIntent,
      getTelegramDesktopIntentStatus,
      loginWithTelegramDesktopIntent,
      bindEmail,
      bindTelegram,
      bindTelegramByDesktopIntent,
      logout,
    }),
    [
      bindEmail,
      bindTelegramByDesktopIntent,
      bindTelegram,
      createTelegramDesktopIntent,
      getTelegramDesktopIntentStatus,
      isLoading,
      loginWithEmailCode,
      loginWithTelegramDesktopIntent,
      loginWithTelegramCallback,
      logout,
      sendEmailCode,
      session,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
