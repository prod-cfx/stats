'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PublicCompaniesTable } from '@/components/public-companies/PublicCompaniesTable';
import { BodyText, PageTitle } from '@/components/ui/Typography';

export default function PublicCompaniesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>币股</PageTitle>
            <BodyText>持有加密资产的上市公司概览</BodyText>
          </div>
          
          <PublicCompaniesTable />
        </div>
      </main>
    </div>
  );
}


