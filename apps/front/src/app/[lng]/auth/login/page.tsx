'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { EmailOtpForm } from '@/features/auth/components/EmailOtpForm'
import { TelegramLoginButtons } from '@/features/auth/components/TelegramLoginButtons'
import { useAuth } from '@/hooks/use-auth'

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const { isAuthenticated } = useAuth()
  const redirect = searchParams?.get('redirect') || `/${lng}/account`

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirect)
    }
  }, [isAuthenticated, redirect, router])

  if (isAuthenticated) return null

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full max-w-[520px] space-y-6 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 shadow-xl md:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">
              {t('nav.login')}
            </h1>
            <p className="text-sm text-[color:var(--cf-muted)]">
              {t('auth.loginDesc')}
            </p>
          </div>

          <EmailOtpForm onSuccess={() => router.replace(redirect)} />

          <div className="relative py-1 text-center text-xs text-[color:var(--cf-muted)]">
            <span className="px-2">{t('auth.or')}</span>
          </div>

          <TelegramLoginButtons lng={lng} redirect={redirect} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
