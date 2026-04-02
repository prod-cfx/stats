import type { Metadata } from 'next'
import React from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BodyText, PageTitle } from '@/components/ui/Typography'
import { getServerTranslator } from '@/lib/i18n/server'
import { getPageMetadata } from '@/lib/page-metadata'
import { PredictionMarketGridClient } from './PredictionMarketGridClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('prediction-market', resolved.lng)
}

export default async function PredictionMarketPage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const { t } = await getServerTranslator(lng)

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 md:gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('predictionMarket.title')}</PageTitle>
            <BodyText>{t('predictionMarket.subtitle')}</BodyText>
          </div>

          <PredictionMarketGridClient />
        </div>
      </main>
      <Footer />
    </div>
  )
}
