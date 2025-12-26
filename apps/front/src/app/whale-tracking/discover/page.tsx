'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DiscoverGrid } from '@/components/whale-tracking/discover/DiscoverGrid';

export default function DiscoverPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold text-white tracking-tight">发现</h1>
            <p className="text-[#999999] text-lg">发现最有价值的交易者</p>
          </div>
          
          <DiscoverGrid />
        </div>
      </main>
    </div>
  );
}

