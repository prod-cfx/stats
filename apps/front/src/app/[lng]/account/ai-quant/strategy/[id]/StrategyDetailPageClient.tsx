'use client'

import { useEffect, useMemo } from 'react'
import { getStrategyById } from '@/components/account/ai-quant-strategy-store'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { useAuth } from '@/hooks/use-auth'

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const { session, isLoading } = useAuth()
  const strategy = useMemo(() => getStrategyById(id), [id])

  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = `/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/account/ai-quant/strategy/${id}`)}`
    }
  }, [id, isLoading, lng, session])

  if (isLoading || !session) {
    return <main className="mx-auto w-full max-w-[920px] flex-1 px-4 py-8 md:px-8" />
  }

  return <AiQuantStrategyDetail lng={lng} strategy={strategy} />
}
