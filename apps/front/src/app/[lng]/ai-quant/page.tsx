import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { getPageMetadata } from '@/lib/page-metadata'
import { AiQuantPageClient } from './AiQuantPageClient'

const AI_QUANT_DEPLOY_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim()
  || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  || process.env.NEXT_PUBLIC_APP_ENV?.trim()
  || 'local-dev'
const AI_QUANT_SERVER_OWNED_CONVERSATIONS = true

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
      <AiQuantPageClient
        deployVersion={AI_QUANT_DEPLOY_VERSION}
        serverOwnedConversations={AI_QUANT_SERVER_OWNED_CONVERSATIONS}
      />
      <Footer />
    </div>
  )
}
