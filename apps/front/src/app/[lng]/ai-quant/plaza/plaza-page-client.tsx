'use client'

import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { setIntent } from '@/components/ai-quant/intent-storage'
import { StrategyPlaza } from '@/components/ai-quant/StrategyPlaza'
import { useAuth } from '@/hooks/use-auth'

export function AiQuantPlazaPageClient() {
  const { t } = useTranslation()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { session, isLoading } = useAuth()

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant`)}`)
  }

  if (isLoading) {
    return <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8" />
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8">
        <GuestAiQuantLanding onRequireLogin={goLoginWithIntent} />
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.plaza')}</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.plazaSubtitle')}</p>
        </div>
        <Link
          href={`/${lng}/ai-quant`}
          className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          {t('aiQuant.title')}
        </Link>
      </div>

      <StrategyPlaza
        subtitle={t('aiQuant.strategyPlazaSubtitle')}
        onRunStrategy={(strategyId) => {
          setIntent({ type: 'run', strategyId })
          router.push(`/${lng}/ai-quant`)
        }}
        onEditStrategy={(strategyId) => {
          setIntent({ type: 'edit', strategyId })
          router.push(`/${lng}/ai-quant`)
        }}
      />
    </main>
  )
}
