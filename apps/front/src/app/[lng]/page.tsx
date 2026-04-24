import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AiQuantMarketingHome } from '@/components/ai-quant/AiQuantMarketingHome'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { getServerTranslator } from '@/lib/i18n/server'
import { getPageMetadata } from '@/lib/page-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('home', resolved.lng)
}

export default async function HomePage({
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
      <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-[color:var(--cf-muted)]">{t('common.loading')}</main>}>
        <AiQuantMarketingHome lng={lng} />
      </Suspense>
      <Footer />
    </div>
  )
}
