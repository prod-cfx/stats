'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { LiquidationSummary } from '@/components/liquidation-data/LiquidationSummary';
import { LiquidationInfoBar } from '@/components/liquidation-data/LiquidationInfoBar';
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable';

export default function LiquidationDataPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6">
        <div className="max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          {/* Summary Section */}
          <LiquidationSummary />
          
          {/* Info Bar Section */}
          <LiquidationInfoBar />
          
          {/* Exchange Table Section */}
          <ExchangeLiquidationTable />
        </div>
      </main>
    </div>
  );
}

