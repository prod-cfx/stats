'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useReducer } from 'react'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { shouldSuppressAuthGate } from '@/features/auth/auth-gate-suppression'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategyDetail } from '@/lib/api'
import { createSearchParamReader } from '@/lib/search-params'

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

function resolvePlazaReturnHref(lng: 'zh' | 'en', value: string | null) {
  const plazaHref = `/${lng}/ai-quant/plaza`
  return value === plazaHref ? plazaHref : null
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const { session, isLoading } = useAuth()
  const { openAuth } = useAuthSheet()
  // React Doctor: page.tsx already wraps this client component in Suspense.
  // react-doctor-disable-next-line react-doctor/nextjs-no-use-search-params-without-suspense
  const searchParams = useSearchParams()
  const { get } = useMemo(() => createSearchParamReader(searchParams), [searchParams])
  const [detailState, dispatchDetailState] = useReducer(
    (
      _state: { strategy: AiQuantStrategyRecord | null; isDetailLoading: boolean },
      action:
        | { type: 'loading' }
        | { type: 'loaded'; strategy: AiQuantStrategyRecord | null },
    ) => {
      if (action.type === 'loading') return { strategy: null, isDetailLoading: true }
      return { strategy: action.strategy, isDetailLoading: false }
    },
    { strategy: null, isDetailLoading: true },
  )
  const plazaReturnHref = resolvePlazaReturnHref(lng, get('from'))
  const strategyRedirect = plazaReturnHref
    ? `/${lng}/account/ai-quant/strategy/${id}?from=${encodeURIComponent(plazaReturnHref)}`
    : `/${lng}/account/ai-quant/strategy/${id}`
  const closeRedirect = plazaReturnHref ?? `/${lng}/account?tab=ai-quant`

  useEffect(() => {
    if (!isLoading && !session) {
      if (shouldSuppressAuthGate()) return
      openAuth({ lng, redirect: strategyRedirect, closeRedirect })
    }
  }, [closeRedirect, isLoading, lng, openAuth, session, strategyRedirect])

  useEffect(() => {
    if (isLoading || !session) return
    let cancelled = false
    dispatchDetailState({ type: 'loading' })

    void fetchAccountAiQuantStrategyDetail(id, session.userId)
      .then(detail => {
        if (cancelled) return
        dispatchDetailState({ type: 'loaded', strategy: mapAccountStrategyDetailToRecord(detail) })
      })
      .catch(() => {
        if (cancelled) return
        dispatchDetailState({ type: 'loaded', strategy: null })
      })

    return () => {
      cancelled = true
    }
  }, [id, isLoading, session])

  if (isLoading || !session || detailState.isDetailLoading) {
    return (
      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 lg:p-6">
          <div className="flex animate-pulse flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-20 rounded-full bg-[color:var(--cf-surface-2)]" />
              <div className="h-7 w-28 rounded-full bg-[color:var(--cf-surface-2)]" />
              <div className="h-7 w-16 rounded-full bg-[color:var(--cf-surface-2)]" />
            </div>
            <div className="h-10 max-w-xl rounded-xl bg-[color:var(--cf-surface-2)]" />
            <div className="h-5 max-w-3xl rounded-lg bg-[color:var(--cf-surface-2)]" />
            <div className="grid gap-3 md:grid-cols-4">
              {['summary', 'risk', 'runtime', 'version'].map(item => (
                <div key={item} className="h-24 rounded-xl bg-[color:var(--cf-bg)]" />
              ))}
            </div>
          </div>
        </section>
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-80 animate-pulse rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]" />
          <div className="h-80 animate-pulse rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]" />
        </section>
      </main>
    )
  }

  return (
    <AiQuantStrategyDetail
      lng={lng}
      strategy={detailState.strategy}
      backHref={plazaReturnHref ?? undefined}
      backLabelKey={plazaReturnHref ? 'aiQuant.plaza' : undefined}
    />
  )
}
