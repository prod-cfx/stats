import React, { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { WhalePositionsTable } from '@/components/whale-tracking/holdings/WhalePositionsTable';
import { getServerTranslator } from '@/lib/i18n/server'

export default async function WhalePositionsPage() {
  const { t } = await getServerTranslator()
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full">
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">{t('common.loading')}</div>}>
            <WhalePositionsTable />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
