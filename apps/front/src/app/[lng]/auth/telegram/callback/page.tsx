import { Suspense } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { TelegramCallbackPageClient } from './TelegramCallbackPageClient'

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
      <Suspense fallback={<main className="flex flex-1 items-center justify-center text-[color:var(--cf-muted)]">Loading...</main>}>
        <TelegramCallbackPageClient lng={lng} />
      </Suspense>
      <Footer />
    </div>
  )
}
