import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { AiQuantPlazaPageClient } from './PlazaPageClient'

export default function AiQuantPlazaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantPlazaPageClient />
      <Footer />
    </div>
  )
}

