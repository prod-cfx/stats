import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { getServerTranslator } from '@/lib/i18n/server'
import { getPageMetadata } from '@/lib/page-metadata'
import { WhaleProfileClientPage } from './WhaleProfileClientPage'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params)
  return getPageMetadata('whale-tracking/profile', resolved.lng)
}

export default async function WhaleProfilePage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const { t } = await getServerTranslator(lng)

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--cf-bg)] text-[color:var(--cf-text-strong)]">
          {t('common.loading')}
        </div>
      }
    >
      <WhaleProfileClientPage />
    </Suspense>
  )
}
