'use client';

import { ChevronDown, Info } from 'lucide-react';
import React from 'react';

export const TopBar = () => {
  return (
    <div className="h-[61px] bg-[#161b22] border-b border-[#30363d] flex items-center text-[#c9d1d9] w-full">
      {/* Left Area: Navigation - Matches LeftTradePanel container width limits */}
      <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] flex items-center px-4 gap-4 border-r border-[#30363d] h-full">
        <span className="text-lg font-bold">交易</span>
        <div className="flex items-center gap-1 text-[#8b949e] text-sm cursor-pointer hover:text-[#c9d1d9] transition-colors">
          <span>工具</span>
        </div>
      </div>
      
      {/* Center & Right Area: Aligned with the Chart area */}
      <div className="flex-1 flex items-center gap-6 px-4 overflow-hidden h-full">
        {/* Symbol and Main Price */}
        <div className="flex items-center gap-4 flex-none">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black">
              ₿
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-base whitespace-nowrap">BTCUSDT 永续</span>
              <ChevronDown className="w-4 h-4 text-[#8b949e] group-hover:text-[#c9d1d9]" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[#ef4444] font-semibold text-lg leading-tight">87,010.0</span>
            <div className="flex items-center gap-2 text-[10px] leading-tight text-[#ef4444]">
              <span>-389.9</span>
              <span>-0.45%</span>
            </div>
          </div>
        </div>

        {/* Market Stats - Flexible list with reduced gap for small screens */}
        <div className="flex-1 flex items-center gap-6 text-[11px] overflow-x-auto no-scrollbar">
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">指数价格</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">¥87,055.0</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">标记价格</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">87,003.3</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <div className="flex items-center gap-1">
              <span className="text-[#8b949e] whitespace-nowrap">资金费率</span>
              <Info className="w-3 h-3 text-[#8b949e]" />
            </div>
            <span className="text-orange-400 whitespace-nowrap">0.004%</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">24小时最低</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">¥86,532.7</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">24小时最高</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">¥88,333.0</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">持仓量</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">2.40万 BTC</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">24小时量</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">6.82万 BTC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
