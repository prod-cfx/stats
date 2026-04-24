import { AiQuantMarketingHome } from '@/components/ai-quant/AiQuantMarketingHome'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantMarketingHome />
      <Footer />
    </div>
  )
}
