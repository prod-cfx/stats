import React, { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BodyText, PageTitle } from '@/components/ui/Typography'
import { DiscoverGrid } from '@/components/whale-tracking/discover/DiscoverGrid'
import { getServerTranslator } from '@/lib/i18n/server'

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const { t } = await getServerTranslator(lng)

  return (
    <div className="flex flex-col min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6 md:gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('whaleTracking.discover.title')}</PageTitle>
            <BodyText>{t('whaleTracking.discover.subtitle')}</BodyText>
          </div>
          
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[color:var(--cf-muted)]">{t('common.loading')}</div>}>
            <DiscoverGrid />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
