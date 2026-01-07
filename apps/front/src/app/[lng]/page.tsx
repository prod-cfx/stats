'use client';

import type { DataSource, MarketType } from '@/types/trading';
import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
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
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
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

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          
          {/* Main Layout: Center(Chart) + Right */}
          <div className="flex-1 flex min-h-0 w-full">
            {/* Center Content (Chart Only) */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative overflow-hidden">
              <CenterChartPanel
                isAggregated={isAggregated}
                setIsAggregated={setIsAggregated}
                selectedExchange={selectedExchange}
                setSelectedExchange={setSelectedExchange}
                symbol={selectedSymbol}
              />
            </div>

            {/* Right Panel - Independent Scroll */}
            <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] border-l border-[#30363d] h-full overflow-y-auto no-scrollbar">
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
    </div>
  );
}
