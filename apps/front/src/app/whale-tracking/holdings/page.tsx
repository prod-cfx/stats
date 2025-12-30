'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { WhalePositionsTable } from '@/components/whale-tracking/holdings/WhalePositionsTable';

export default function WhalePositionsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full">
          <WhalePositionsTable />
        </div>
      </main>
    </div>
  );
}
