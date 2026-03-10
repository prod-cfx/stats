import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { AiQuantPageClient } from './AiQuantPageClient'

export default function AiQuantPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantPageClient />
      <Footer />
    </div>
  )
}
