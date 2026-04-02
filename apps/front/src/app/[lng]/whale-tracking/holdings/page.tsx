import React, { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { WhalePositionsTable } from '@/components/whale-tracking/holdings/WhalePositionsTable'
import { getServerTranslator } from '@/lib/i18n/server'

export default async function WhalePositionsPage({
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
        <div className="max-w-[1440px] mx-auto w-full">
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[color:var(--cf-muted)]">{t('common.loading')}</div>}>
            <WhalePositionsTable />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
