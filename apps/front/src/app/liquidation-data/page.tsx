'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { LiquidationSummary } from '@/components/liquidation-data/LiquidationSummary';
import { LiquidationInfoBar } from '@/components/liquidation-data/LiquidationInfoBar';
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable';
import { PageTitle, BodyText } from '@/components/ui/Typography';

export default function LiquidationDataPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>爆仓数据</PageTitle>
            <BodyText>追踪全网实时爆仓数据</BodyText>
          </div>
          
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

