import React, { Suspense } from 'react';
import { getServerTranslator } from '@/lib/i18n/server'
import { WhaleProfileClientPage } from './WhaleProfileClientPage'

export default async function WhaleProfilePage() {
  const { t } = await getServerTranslator()
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">{t('common.loading')}</div>}>
      <WhaleProfileClientPage />
    </Suspense>
  );
}
