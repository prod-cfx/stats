import type { Metadata } from 'next'
import { AiQuantMarketingHome } from '@/components/ai-quant/AiQuantMarketingHome'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
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

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantMarketingHome lng={lng} />
      <Footer />
    </div>
  )
}
