'use client';

import { ChevronDown } from 'lucide-react';
import React from 'react';
import { PnLTrendChart } from './PnLTrendChart';

export const PnLTrendCard = () => {
  // Generate mock data for 1 week at ~2 hour intervals
  const generateMockData = () => {
    const data = [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let currentValue = -200000; // Starting point
    const hoursInWeek = 7 * 24;
    
    for (let i = 0; i <= hoursInWeek; i += 2) {
      const date = new Date(oneWeekAgo.getTime() + i * 60 * 60 * 1000);
      const ts = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:00`;
      
      // Random walk with a trend towards the Figma value -414,743.38
      const change = (Math.random() - 0.6) * 50000; // More likely to go down
      currentValue += change;
      
      data.push({ ts, value: currentValue });
    }
    
    // Ensure final value is close to Figma design
    data[data.length - 1].value = -414743.38;
    return data;
  };

  const mockData = generateMockData();

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="text-[#8b949e] text-body font-medium">1周 总盈亏 (仅永续合约)</div>
          <div className="text-[#4ade80] text-h1 font-bold tracking-tight">$ +1,978,371.60</div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>1周</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>仅永续合约</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e5e5e5] text-caption font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>总盈亏</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[300px] w-full">
        <PnLTrendChart data={mockData} />
      </div>
    </div>
  );
};


