'use client'

import { useRouter } from 'next/navigation'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { normalizeAuthRedirect } from '@/features/auth/auth-redirect'
import { AuthSheet } from '@/features/auth/components/AuthSheet'

interface OpenAuthInput {
  lng: 'zh' | 'en'
  redirect?: string
  closeRedirect?: string
}

interface AuthSheetState extends OpenAuthInput {
  open: boolean
}

interface AuthSheetContextValue {
  openAuth: (input: OpenAuthInput) => void
  closeAuth: () => void
}

const AuthSheetContext = createContext<AuthSheetContextValue | null>(null)

export function AuthSheetProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthSheetState>({
    open: false,
    lng: 'zh',
    redirect: undefined,
  })

  const openAuth = useCallback((input: OpenAuthInput) => {
    const safeRedirect = normalizeAuthRedirect(input.redirect, input.lng)
    const safeCloseRedirect = normalizeAuthRedirect(input.closeRedirect, input.lng)
    setState({
      open: true,
      lng: input.lng,
      redirect: safeRedirect,
      closeRedirect: safeCloseRedirect,
    })
  }, [])

  const closeAuth = useCallback(() => {
    setState(previous => ({ ...previous, open: false }))
    const safeCloseRedirect = normalizeAuthRedirect(state.closeRedirect, state.lng)
    if (safeCloseRedirect) router.replace(safeCloseRedirect)
  }, [router, state.closeRedirect, state.lng])

  const handleSuccess = useCallback((redirect?: string) => {
    setState(previous => ({ ...previous, open: false }))
    const safeRedirect = normalizeAuthRedirect(redirect, state.lng)
    if (safeRedirect) router.replace(safeRedirect)
  }, [router, state.lng])

  const value = useMemo(() => ({ openAuth, closeAuth }), [closeAuth, openAuth])

  return (
    <AuthSheetContext.Provider value={value}>
      {children}
      <AuthSheet
        open={state.open}
        lng={state.lng}
        redirect={state.redirect}
        onOpenChange={open => {
          if (!open) closeAuth()
        }}
        onSuccess={handleSuccess}
      />
    </AuthSheetContext.Provider>
  )
}

export function useAuthSheet() {
  const value = useContext(AuthSheetContext)
  if (!value) {
    throw new Error('useAuthSheet must be used within AuthSheetProvider')
  }
  return value
}
