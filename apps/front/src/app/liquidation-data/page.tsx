'use client';

import React, { Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable';
import { LiquidationInfoBar } from '@/components/liquidation-data/LiquidationInfoBar';
import { LiquidationSummary } from '@/components/liquidation-data/LiquidationSummary';
import { BodyText, PageTitle } from '@/components/ui/Typography';

function LiquidationDataContent() {
  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageTitle>爆仓数据</PageTitle>
        <BodyText>追踪全网实时爆仓数据</BodyText>
      </div>
      <LiquidationSummary />
      <LiquidationInfoBar />
      <ExchangeLiquidationTable />
    </div>
  );
}

export default function LiquidationDataPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#8b949e]">加载中...</div>}>
          <LiquidationDataContent />
        </Suspense>
      </main>
    </div>
  );
}
