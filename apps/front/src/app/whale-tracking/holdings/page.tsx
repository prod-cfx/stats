'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { WhalePositionsTable } from '@/components/whale-tracking/holdings/WhalePositionsTable';

export default function WhalePositionsPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full">
          <WhalePositionsTable />
        </div>
      </main>
    </div>
  );
}

