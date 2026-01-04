'use client';

import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileClient } from './ProfileClient';

function ProfileContent() {
  const searchParams = useSearchParams();
  const address = searchParams.get('address') || '0xb31754025d57d727218ef86b97828135899983ae';
  
  return <ProfileClient address={address} />;
}

export default function WhaleProfilePage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">{t('common.loading')}</div>}>
      <ProfileContent />
    </Suspense>
  );
}
