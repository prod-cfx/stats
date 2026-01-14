'use client';

import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { AggregatedOrderBookClient } from './AggregatedOrderBookClient';

export default function AggregatedOrderBookPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>{t('aggregatedOrderbook.title')}</PageTitle>
            <BodyText>{t('aggregatedOrderbook.subtitle')}</BodyText>
          </div>
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
            <AggregatedOrderBookClient />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
