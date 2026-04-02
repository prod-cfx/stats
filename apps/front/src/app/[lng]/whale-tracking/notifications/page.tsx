import React, { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { NotificationsClient } from '@/components/whale-tracking/notifications/NotificationsClient'
import { getServerTranslator } from '@/lib/i18n/server'

export default async function WhaleNotificationsPage({
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
        <div className="mx-auto w-full max-w-[1440px]">
          <Suspense fallback={<div className="flex h-96 items-center justify-center text-[color:var(--cf-muted)]">{t('common.loading')}</div>}>
            <NotificationsClient />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
