'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AiQuantStrategyList } from './AiQuantStrategyList'

export function AiQuantSection({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4">
      <section className="flex items-center justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.title')}</h2>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
            {t('aiQuant.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${lng}/account?tab=ai-quant#exchange-api`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            {t('aiQuant.configApi')}
          </Link>
          <Link
            href={`/${lng}/ai-quant`}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold !text-white shadow-sm transition-all hover:from-violet-600 hover:to-purple-700"
          >
            {t('aiQuant.createStrategy')}
          </Link>
        </div>
      </section>

      <AiQuantStrategyList lng={lng} />
    </section>
  )
}
