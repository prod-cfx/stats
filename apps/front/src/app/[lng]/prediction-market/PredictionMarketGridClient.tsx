'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import { useTranslation } from 'react-i18next'

function PredictionMarketGridFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex h-96 items-center justify-center text-[color:var(--cf-muted)]">
      {t('common.loading')}
    </div>
  )
}

const PredictionMarketGrid = dynamic(
  () =>
    import('@/components/prediction-market/PredictionMarketGrid').then(
      mod => mod.PredictionMarketGrid,
    ),
  {
    ssr: false,
    loading: PredictionMarketGridFallback,
  },
)

export function PredictionMarketGridClient() {
  return <PredictionMarketGrid />
}
