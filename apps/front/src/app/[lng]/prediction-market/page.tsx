'use client'

import dynamic from 'next/dynamic'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BodyText, PageTitle } from '@/components/ui/Typography'

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

export default function PredictionMarketPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 md:gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('predictionMarket.title')}</PageTitle>
            <BodyText>{t('predictionMarket.subtitle')}</BodyText>
          </div>

          <PredictionMarketGrid />
        </div>
      </main>
      <Footer />
    </div>
  )
}
