'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo } from 'react'
import { normalizeAuthRedirectOrFallback } from '@/features/auth/auth-redirect'
import { AuthSheet } from '@/features/auth/components/AuthSheet'
import { useAuth } from '@/hooks/use-auth'
import { createSearchParamReader } from '@/lib/search-params'

interface LoginPageClientProps {
  lng: 'zh' | 'en'
}

export function LoginPageClient({ lng }: LoginPageClientProps) {
  const router = useRouter()
  // React Doctor: page.tsx already wraps this client component in Suspense.
  // react-doctor-disable-next-line react-doctor/nextjs-no-use-search-params-without-suspense
  const searchParams = useSearchParams()
  const { get } = useMemo(() => createSearchParamReader(searchParams), [searchParams])
  const { isAuthenticated } = useAuth()
  const accountRedirect = `/${lng}/account`
  const redirect = normalizeAuthRedirectOrFallback(get('redirect'), lng, accountRedirect)
  const closeFallbackPage = () => {
    router.replace(`/${lng}`)
  }

  useEffect(() => {
    if (isAuthenticated) {
      // React Doctor: redirect depends on client auth state from local storage/session hydration.
      // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect
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
