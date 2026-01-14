'use client';

import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { LiquidationDataClient } from './LiquidationDataClient';

export default function LiquidationDataPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('liquidationData.title')}</PageTitle>
            <BodyText>{t('liquidationData.subtitle')}</BodyText>
          </div>
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
            <LiquidationDataClient />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
