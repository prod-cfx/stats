import React, { Suspense } from 'react'
import { getServerTranslator } from '@/lib/i18n/server'
import { WhaleProfileClientPage } from './WhaleProfileClientPage'

export default async function WhaleProfilePage({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const { t } = await getServerTranslator(lng)

  return (
    <Suspense fallback={<div className="min-h-screen bg-[color:var(--cf-bg)] flex items-center justify-center text-[color:var(--cf-text-strong)]">{t('common.loading')}</div>}>
      <WhaleProfileClientPage />
    </Suspense>
  )
}
