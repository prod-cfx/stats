import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { OfficialStrategyBacktestReportClient } from './OfficialStrategyBacktestReportClient'

interface OfficialStrategyBacktestReportPageProps {
  params: Promise<{
    lng: string
    templateId: string
  }>
}

export default async function OfficialStrategyBacktestReportPage({
  params,
}: OfficialStrategyBacktestReportPageProps) {
  const { lng, templateId } = await params

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <OfficialStrategyBacktestReportClient lng={lng === 'en' ? 'en' : 'zh'} templateId={templateId} />
      <Footer />
    </div>
  )
}
