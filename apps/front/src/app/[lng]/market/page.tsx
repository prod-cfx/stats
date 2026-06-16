import type { Metadata } from 'next'
import { getPageMetadata } from '@/lib/page-metadata'
import { MarketPageClient } from '../MarketPageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('market', resolved.lng)
}

export default function MarketPage() {
  return <MarketPageClient />
}
