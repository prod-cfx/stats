'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTelegramLoginConfigRequest } from '@/features/auth/api'
import { EmailOtpForm } from '@/features/auth/components/EmailOtpForm'
import { TelegramLoginButtons } from '@/features/auth/components/TelegramLoginButtons'
import { useAuth } from '@/hooks/use-auth'

interface LoginPageClientProps {
  lng: 'zh' | 'en'
}

export function LoginPageClient({ lng }: LoginPageClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()
  const [betaCode, setBetaCode] = useState('')
  const [betaCodeGateEnabled, setBetaCodeGateEnabled] = useState(false)
  const redirect = searchParams?.get('redirect') || `/${lng}/account`

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirect)
    }
  }, [isAuthenticated, redirect, router])

  useEffect(() => {
    let mounted = true

    async function loadLoginConfig() {
      try {
        const config = await getTelegramLoginConfigRequest()
        if (mounted)
          setBetaCodeGateEnabled(Boolean(config.betaCodeGateEnabled))
      }
      catch {
        if (mounted)
          setBetaCodeGateEnabled(false)
      }
    }

    void loadLoginConfig()

    return () => {
      mounted = false
    }
  }, [])

  if (isAuthenticated) return null

  return (
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

        <EmailOtpForm
          betaCode={betaCode}
          betaCodeGateEnabled={betaCodeGateEnabled}
          onBetaCodeChange={setBetaCode}
          onSuccess={() => router.replace(redirect)}
        />

        <div className="relative py-1 text-center text-xs text-[color:var(--cf-muted)]">
          <span className="px-2">{t('auth.or')}</span>
        </div>

        <TelegramLoginButtons lng={lng} redirect={redirect} betaCode={betaCodeGateEnabled ? betaCode : undefined} />
      </div>
    </main>
  )
}
