import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { getPageMetadata } from '@/lib/page-metadata'
import { AiQuantPageClient } from './AiQuantPageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('ai-quant', resolved.lng)
}

export default function AiQuantPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <AiQuantPageClient />
      <Footer />
    </div>
  )
}
