'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useEffect, useState } from 'react'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { shouldSuppressAuthGate } from '@/features/auth/auth-gate-suppression'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategyDetail } from '@/lib/api'

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const { session, isLoading } = useAuth()
  const { openAuth } = useAuthSheet()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const strategyRedirect = `/${lng}/account/ai-quant/strategy/${id}`

  useEffect(() => {
    if (!isLoading && !session) {
      if (shouldSuppressAuthGate()) return
      openAuth({ lng, redirect: strategyRedirect, closeRedirect: `/${lng}/account?tab=ai-quant` })
    }
  }, [isLoading, lng, openAuth, session, strategyRedirect])

  useEffect(() => {
    if (isLoading || !session) return
    let cancelled = false
    setIsDetailLoading(true)

    void fetchAccountAiQuantStrategyDetail(id, session.userId)
      .then(detail => {
        if (cancelled) return
        setStrategy(mapAccountStrategyDetailToRecord(detail))
      })
      .catch(() => {
        if (cancelled) return
        setStrategy(null)
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, isLoading, session])

  if (isLoading || !session || isDetailLoading) {
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
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-[color:var(--cf-bg)]" />
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

  return <AiQuantStrategyDetail lng={lng} strategy={strategy} />
}
