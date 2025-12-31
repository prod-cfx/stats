'use client';

import React, { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { WhalePositionsTable } from '@/components/whale-tracking/holdings/WhalePositionsTable';

export default function WhalePositionsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full">
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">加载中...</div>}>
            <WhalePositionsTable />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
