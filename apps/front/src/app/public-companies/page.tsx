'use client';

import React, { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PublicCompaniesTable } from '@/components/public-companies/PublicCompaniesTable';
import { BodyText, PageTitle } from '@/components/ui/Typography';

function PublicCompaniesContent() {
  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageTitle>币股</PageTitle>
        <BodyText>持有加密资产的上市公司概览</BodyText>
      </div>
      <PublicCompaniesTable />
    </div>
  );
}

export default function PublicCompaniesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">加载中...</div>}>
          <PublicCompaniesContent />
        </Suspense>
      </main>
    </div>
  );
}
