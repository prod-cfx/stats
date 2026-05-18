'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import { normalizeAuthRedirectOrFallback } from '@/features/auth/auth-redirect'
import { AuthSheet } from '@/features/auth/components/AuthSheet'
import { useAuth } from '@/hooks/use-auth'

interface LoginPageClientProps {
  lng: 'zh' | 'en'
}

export function LoginPageClient({ lng }: LoginPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const accountRedirect = `/${lng}/account`
  const redirect = normalizeAuthRedirectOrFallback(searchParams?.get('redirect'), lng, accountRedirect)
  const closeFallbackPage = () => {
    router.replace(`/${lng}`)
  }

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirect)
    }
  }, [isAuthenticated, redirect, router])

  if (isAuthenticated) return null

  return (
    <main className="relative flex min-h-[calc(100dvh-64px)] flex-1 items-end justify-center overflow-hidden bg-[color:var(--cf-bg)] px-0 pt-24 md:min-h-0 md:items-center md:px-8 md:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[58dvh] bg-[radial-gradient(circle_at_50%_10%,rgba(139,92,255,0.18),transparent_32%),linear-gradient(180deg,rgba(57,107,255,0.12),transparent_70%)] md:hidden" />
      <AuthSheet
        open
        fallbackPage
        lng={lng}
        redirect={redirect}
        onOpenChange={open => {
          if (!open) closeFallbackPage()
        }}
        onSuccess={nextRedirect => router.replace(normalizeAuthRedirectOrFallback(nextRedirect || redirect, lng, redirect))}
      />
    </main>
  )
}
