import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BodyText, PageTitle } from '@/components/ui/Typography'
import { getServerTranslator } from '@/lib/i18n/server'
import { getPageMetadata } from '@/lib/page-metadata'
import { AggregatedOrderBookClient } from './AggregatedOrderBookClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('aggregated-orderbook', resolved.lng)
}

export default async function AggregatedOrderBookPage({
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
      <main className="flex-1 p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('aggregatedOrderbook.title')}</PageTitle>
            <BodyText>{t('aggregatedOrderbook.subtitle')}</BodyText>
          </div>
          <Suspense
            fallback={
              <div className="flex h-96 items-center justify-center text-[color:var(--cf-muted)]">
                {t('common.loading')}
              </div>
            }
          >
            <AggregatedOrderBookClient />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
