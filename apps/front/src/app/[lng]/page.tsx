import { AiQuantMarketingHome } from '@/components/ai-quant/AiQuantMarketingHome'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { getServerTranslator } from '@/lib/i18n/server'

export default async function HomePage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const { lng, t } = await getServerTranslator(resolved.lng)

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantMarketingHome lng={lng} t={t} />
      <Footer />
    </div>
  )
}
