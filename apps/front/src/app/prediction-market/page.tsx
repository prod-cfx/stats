'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PredictionMarketGrid } from '@/components/prediction-market/PredictionMarketGrid';
import { PageTitle, BodyText } from '@/components/ui/Typography';

export default function PredictionMarketPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <PageTitle>预测市场</PageTitle>
            <BodyText>基于链上数据的未来趋势预测</BodyText>
          </div>
          
          <PredictionMarketGrid />
        </div>
      </main>
    </div>
  );
}


