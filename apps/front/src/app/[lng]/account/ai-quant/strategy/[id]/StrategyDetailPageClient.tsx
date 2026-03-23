'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useEffect, useState } from 'react'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategyDetail } from '@/lib/api'

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const { session, isLoading } = useAuth()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = `/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/account/ai-quant/strategy/${id}`)}`
    }
  }, [id, isLoading, lng, session])

  useEffect(() => {
    if (isLoading || !session) return
    let cancelled = false
    setIsDetailLoading(true)

    void fetchAccountAiQuantStrategyDetail(id)
      .then((detail) => {
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
    return <main className="mx-auto w-full max-w-[920px] flex-1 px-4 py-8 md:px-8" />
  }

  return <AiQuantStrategyDetail lng={lng} strategy={strategy} />
}
