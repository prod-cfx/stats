'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useCallback, useEffect, useState } from 'react'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategyDetail, updateAccountAiQuantStrategyLeverage } from '@/lib/api'
import { ApiError } from '@/lib/errors'

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

function getStrategyUpdateErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message.trim()) {
    return error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return '策略配置更新失败，请稍后重试。'
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const { session, isLoading } = useAuth()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [isUpdatingLeverage, setIsUpdatingLeverage] = useState(false)
  const [leverageUpdateError, setLeverageUpdateError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = `/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/account/ai-quant/strategy/${id}`)}`
    }
  }, [id, isLoading, lng, session])

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

  const handleUpdateLeverage = useCallback(
    async (leverage: number) => {
      if (!session?.userId || !strategy) return
      setLeverageUpdateError(null)
      setIsUpdatingLeverage(true)
      try {
        const detail = await updateAccountAiQuantStrategyLeverage(strategy.id, {
          userId: session.userId,
          leverage,
        })
        setStrategy(mapAccountStrategyDetailToRecord(detail))
      } catch (error) {
        setLeverageUpdateError(getStrategyUpdateErrorMessage(error))
      } finally {
        setIsUpdatingLeverage(false)
      }
    },
    [session?.userId, strategy],
  )

  if (isLoading || !session || isDetailLoading) {
    return <main className="mx-auto w-full max-w-[920px] flex-1 px-4 py-8 md:px-8" />
  }

  return (
    <AiQuantStrategyDetail
      lng={lng}
      strategy={strategy}
      onUpdateLeverage={handleUpdateLeverage}
      isUpdatingLeverage={isUpdatingLeverage}
      leverageUpdateError={leverageUpdateError}
    />
  )
}
