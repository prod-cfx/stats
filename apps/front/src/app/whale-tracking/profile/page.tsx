'use client'

import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { WhaleProfileClientPage } from './WhaleProfileClientPage'

export default function WhaleProfilePage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">{t('common.loading')}</div>}>
      <WhaleProfileClientPage />
    </Suspense>
  );
}
