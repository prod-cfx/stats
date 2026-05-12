'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export function AuthGateCard({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto w-full max-w-[680px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.authGate.title')}</h1>
      <p className="mt-2 text-sm text-[color:var(--cf-muted)]">
        {t('aiQuant.authGate.description')}
      </p>
      <Link
        href={`/${lng}/auth/login`}
        className="from-primary to-secondary mt-6 inline-flex rounded-xl bg-gradient-to-r px-5 py-2 text-sm font-bold text-white"
      >
        {t('aiQuant.authGate.login')}
      </Link>
    </section>
  )
}
