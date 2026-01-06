'use client';

import React, { useState } from 'react';
import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
import { RightPanel } from '@/components/trading/RightPanel/RightPanel';
import { TopBar } from '@/components/trading/TopBar/TopBar';

export type DataSource = 'binance' | 'okx';
export type MarketType = 'futures' | 'spot';

export default function TradingPage() {
  const [isAggregated, setIsAggregated] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<DataSource>('binance');
  const [marketType, setMarketType] = useState<MarketType>('futures');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Top Bar fixed at the top */}
      <TopBar
        isAggregated={isAggregated}
        selectedExchange={selectedExchange}
        marketType={marketType}
        setMarketType={setMarketType}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
      />

      <div className="flex-1 flex overflow-hidden p-8">
        <div className="w-full max-w-[1440px] mx-auto flex overflow-hidden gap-4">
          {/* Left Panel - Fixed Width */}
          <div className="w-[280px] flex-none flex flex-col min-h-0">
            <LeftTradePanel
              symbol={selectedSymbol}
              isAggregated={isAggregated}
              selectedExchange={selectedExchange}
            />
          </div>

          {/* Center Content (Chart + Bottom Area) */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex min-h-0">
              {/* Main Chart Section */}
              <CenterChartPanel
                isAggregated={isAggregated}
                setIsAggregated={setIsAggregated}
                selectedExchange={selectedExchange}
                setSelectedExchange={setSelectedExchange}
                symbol={selectedSymbol}
                marketType={marketType}
              />
            </div>

            {/* Bottom Tabs Section */}
            <BottomPanel symbol={selectedSymbol} />
          </div>

          {/* Right Panel - Fixed Width */}
          <div className="w-[320px] flex-none flex flex-col min-h-0">
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
  );
}



