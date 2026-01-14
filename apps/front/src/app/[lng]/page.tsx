'use client';

import type { DataSource, MarketType } from '@/types/trading';
import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
// import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
// import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
import { RightPanel } from '@/components/trading/RightPanel/RightPanel';
import { TopBar } from '@/components/trading/TopBar/TopBar';

export default function MarketPage() {
  const [isAggregated, setIsAggregated] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<DataSource>('binance');
  const [marketType, setMarketType] = useState<MarketType>('futures');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Global Navbar */}
      <div className="flex-none">
        <Navbar />
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Top Bar fixed below Navbar */}
        <div className="flex-none">
          <TopBar
            isAggregated={isAggregated}
            selectedExchange={selectedExchange}
            marketType={marketType}
            setMarketType={setMarketType}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          
          {/* Main Layout: Center(Chart) + Right */}
          <div className="flex flex-col md:flex-row min-h-0 w-full">
            {/* Center Content (Chart Only) */}
            <div className="flex-none h-[50vh] md:h-[calc(100vh-120px)] md:flex-1 flex flex-col min-w-0 bg-[#0d1117] relative overflow-hidden border-b md:border-b-0 border-[#30363d]">
              <CenterChartPanel
                isAggregated={isAggregated}
                setIsAggregated={setIsAggregated}
                selectedExchange={selectedExchange}
                setSelectedExchange={setSelectedExchange}
                symbol={selectedSymbol}
              />
            </div>

            {/* Right Panel - Independent Scroll */}
            <div className="flex-none w-full md:w-[20%] md:max-w-[340px] md:min-w-[240px] border-l-0 md:border-l border-[#30363d] h-auto md:h-[calc(100vh-120px)] overflow-y-visible md:overflow-y-auto cf-scrollbar pr-1 pb-10 md:pb-0">
              <RightPanel
                isAggregated={isAggregated}
                selectedExchange={selectedExchange}
                symbol={selectedSymbol}
                marketType={marketType}
              />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
