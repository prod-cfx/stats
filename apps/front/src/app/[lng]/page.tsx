'use client';

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BottomPanel } from '@/components/trading/BottomPanel/BottomPanel';
import { CenterChartPanel } from '@/components/trading/CenterChartPanel/CenterChartPanel';
import { LeftTradePanel } from '@/components/trading/LeftTradePanel/LeftTradePanel';
import { RightPanel } from '@/components/trading/RightPanel/RightPanel';
import { TopBar } from '@/components/trading/TopBar/TopBar';

export default function MarketPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Global Navbar */}
      <div className="flex-none">
        <Navbar />
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Top Bar fixed below Navbar */}
        <div className="flex-none">
          <TopBar />
        </div>

        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {/* Left Panel - Fixed Sidebar, Independent Scroll */}
          <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] border-r border-[#30363d] h-full">
            <LeftTradePanel />
          </div>

          {/* Main Content Area (Center + Right) - Unified Scroll */}
          <div className="flex-1 flex overflow-y-auto no-scrollbar h-full">
            {/* Inner Wrapper to hold Center and Right side-by-side */}
            <div className="flex-1 flex min-h-full">
              
              {/* Center Content (Chart + Bottom Area) */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chart Section - Fixed minimum height to ensure it's usable */}
                <div className="h-[600px] min-h-[500px] relative border-b border-[#30363d]">
                  <CenterChartPanel />
                </div>

                {/* Bottom Tabs Section - Auto height based on content */}
                <div className="min-h-[300px]">
                  <BottomPanel />
                </div>
              </div>

              {/* Right Panel - Flows with the page scroll */}
              <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] border-l border-[#30363d]">
                <RightPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
