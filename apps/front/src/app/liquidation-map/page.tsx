import React, { Suspense } from 'react'
import { Navbar } from '@/components/layout/Navbar';
import { getServerTranslator } from '@/lib/i18n/server'
import { LiquidationMapClient } from './LiquidationMapClient'

export default async function LiquidationMapPage() {
  const { t } = await getServerTranslator()
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
          <LiquidationMapClient />
        </Suspense>
      </main>
    </div>
  );
}
