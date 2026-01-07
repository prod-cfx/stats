'use client';

import type { DataSource, MarketType } from '@/types/trading';
import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
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

        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {/* Left Panel - Fixed Sidebar, Independent Scroll */}
          <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] border-r border-[#30363d] h-full">
            <LeftTradePanel
              symbol={selectedSymbol}
              isAggregated={isAggregated}
              selectedExchange={selectedExchange}
            />
          </div>

          {/* Main Content Area (Center + Right) - Unified Scroll */}
          <div className="flex-1 flex overflow-y-auto no-scrollbar h-full">
            {/* Inner Wrapper to hold Center and Right side-by-side */}
            <div className="flex-1 flex min-h-full">
              
              {/* Center Content (Chart + Bottom Area) */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chart Section - Fixed minimum height to ensure it's usable */}
                <div className="h-[600px] min-h-[500px] relative border-b border-[#30363d]">
                  <CenterChartPanel
                    isAggregated={isAggregated}
                    setIsAggregated={setIsAggregated}
                    selectedExchange={selectedExchange}
                    setSelectedExchange={setSelectedExchange}
                    symbol={selectedSymbol}
                  />
                </div>

                {/* Bottom Tabs Section - Auto height based on content */}
                <div className="min-h-[300px]">
                  <BottomPanel symbol={selectedSymbol} />
                </div>
              </div>

              {/* Right Panel - Flows with the page scroll */}
              <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] border-l border-[#30363d]">
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
    </div>
  );
}
