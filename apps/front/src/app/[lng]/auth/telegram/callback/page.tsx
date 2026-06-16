import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { getPageMetadata } from '@/lib/page-metadata'
import { TelegramCallbackPageClient } from './TelegramCallbackPageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('auth/telegram/callback', resolved.lng)
}

export default async function TelegramCallbackPage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <Suspense fallback={<main className="flex flex-1 items-center justify-center text-[color:var(--cf-muted)]">Loading…</main>}>
        <TelegramCallbackPageClient lng={lng} />
      </Suspense>
      <Footer />
    </div>
  )
}
