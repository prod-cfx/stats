import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { StrategyDetailPageClient } from './StrategyDetailPageClient'

export default async function AccountAiQuantStrategyDetailPage({
  params,
}: {
  params: Promise<{ lng: string, id: string }> | { lng: string, id: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <StrategyDetailPageClient lng={lng} id={resolved.id} />
      <Footer />
    </div>
  )
}

