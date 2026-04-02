import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPageMetadata } from '@/lib/page-metadata'
import TradingPageClient from './TradingPageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('trade', resolved.lng)
}

export default function TradingPage() {
  return (
    <Suspense fallback={<TradingPageSkeleton />}>
      <TradingPageClient />
    </Suspense>
  )
}

function TradingPageSkeleton() {
  return (
    <div className="flex min-h-screen animate-pulse flex-col overflow-hidden bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <div className="h-14 border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]" />
      <div className="h-14 border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]" />
      <div className="flex flex-1 overflow-hidden p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1440px] gap-4 overflow-hidden">
          <div className="w-[280px] flex-none rounded-lg bg-[color:var(--cf-surface)]" />
          <div className="flex-1 rounded-lg bg-[color:var(--cf-surface)]" />
          <div className="w-[320px] flex-none rounded-lg bg-[color:var(--cf-surface)]" />
        </div>
      </div>
      <div className="h-28 border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]" />
    </div>
  )
}
