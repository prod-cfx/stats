'use client'

import { useTranslation } from 'react-i18next'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'

export function AuthGateCard({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const { openAuth } = useAuthSheet()

  return (
    <section className="mx-auto w-full max-w-[680px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 text-center">
      <h1 className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">{t('aiQuant.authGate.title')}</h1>
      <p className="mt-1 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
        {t('aiQuant.authGate.description')}
      </p>
      <button
        type="button"
        onClick={() => openAuth({ lng, redirect: `/${lng}/ai-quant` })}
        className="from-primary to-secondary mt-4 inline-flex rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white"
      >
        {t('aiQuant.authGate.login')}
      </button>
    </section>
  )
}
