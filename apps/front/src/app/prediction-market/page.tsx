'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PredictionMarketGrid } from '@/components/prediction-market/PredictionMarketGrid';

export default function PredictionMarketPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6">
        <div className="max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">预测市场</h1>
            <p className="text-[#8b949e]">基于链上数据的未来趋势预测</p>
          </div>
          
          <PredictionMarketGrid />
        </div>
      </main>
    </div>
  );
}

