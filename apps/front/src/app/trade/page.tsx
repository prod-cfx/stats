'use client';

import React from 'react';
import { TopBar } from '@/components/trading/TopBar/TopBar';
import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
import { RightPanel } from '@/components/trading/RightPanel/RightPanel';
import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';

export default function TradingPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Top Bar fixed at the top */}
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <LeftTradePanel />

        {/* Center Content (Chart + Bottom Area) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex min-h-0">
            {/* Main Chart Section */}
            <CenterChartPanel />
          </div>

          {/* Bottom Tabs Section */}
          <BottomPanel />
        </div>

        {/* Right Panel */}
        <RightPanel />
      </div>
    </div>
  );
}

