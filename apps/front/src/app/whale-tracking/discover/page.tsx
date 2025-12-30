'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { DiscoverGrid } from '@/components/whale-tracking/discover/DiscoverGrid';

export default function DiscoverPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>发现</PageTitle>
            <BodyText>发现最有价值的交易者</BodyText>
          </div>
          
          <DiscoverGrid />
        </div>
      </main>
    </div>
  );
}
