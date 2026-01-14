'use client';

import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { LiquidationMapClient } from './LiquidationMapClient';

export default function LiquidationMapPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
          <LiquidationMapClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
