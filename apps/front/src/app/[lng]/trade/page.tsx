'use client';

import React from 'react';
import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
import { RightPanel } from '@/components/trading/RightPanel/RightPanel';
import { TopBar } from '@/components/trading/TopBar/TopBar';

export default function TradingPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Top Bar fixed at the top */}
      <TopBar />

      <div className="flex-1 flex overflow-hidden p-8">
        <div className="w-full max-w-[1440px] mx-auto flex overflow-hidden gap-4">
          {/* Left Panel - Fixed Width */}
          <div className="w-[280px] flex-none flex flex-col min-h-0">
            <LeftTradePanel />
          </div>

          {/* Center Content (Chart + Bottom Area) */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex min-h-0">
              {/* Main Chart Section */}
              <CenterChartPanel />
            </div>

            {/* Bottom Tabs Section */}
            <BottomPanel />
          </div>

          {/* Right Panel - Fixed Width */}
          <div className="w-[320px] flex-none flex flex-col min-h-0">
            <RightPanel />
          </div>
        </div>
      </div>
    </div>
  );
}



