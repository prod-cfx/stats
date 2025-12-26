'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PublicCompaniesTable } from '@/components/public-companies/PublicCompaniesTable';

export default function PublicCompaniesPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6">
        <div className="max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">币股</h1>
            <p className="text-[#8b949e]">持有加密资产的上市公司概览</p>
          </div>
          
          <PublicCompaniesTable />
        </div>
      </main>
    </div>
  );
}

