'use client';

import React from 'react';

export const PositionProfile = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl p-6 space-y-8 h-full">
      {/* Title */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[#999999] text-sm font-medium">永续合约总价值</span>
          <span className="px-2 py-0.5 bg-[#2c2c2c] text-[#e5e5e5] text-[10px] font-bold rounded uppercase">当前持仓</span>
        </div>
        <div className="text-white text-xl font-bold tracking-tight">$ 239,670,330.26</div>
      </div>

      {/* Margin Usage Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[#999999] text-sm">平均保证金使用率</span>
          <span className="text-white text-sm font-bold">89.26 %</span>
        </div>
        <div className="h-1.5 w-full bg-[#2c2c2c] rounded-full overflow-hidden">
          <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: '89.26%' }} />
        </div>
      </div>

      {/* Direction Bias */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[#999999] text-sm">方向偏差</span>
          <span className="text-white text-sm font-bold">中性</span>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-[#999999] font-bold uppercase tracking-wider">
              <span>多头持仓</span>
              <span>0 %</span>
            </div>
            <div className="h-1.5 w-full bg-[#2c2c2c] rounded-full overflow-hidden">
              <div className="h-full bg-[#22c55e] rounded-full" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-[#999999] font-bold uppercase tracking-wider">
              <span>空头持仓</span>
              <span>100 %</span>
            </div>
            <div className="h-1.5 w-full bg-[#2c2c2c] rounded-full overflow-hidden">
              <div className="h-full bg-[#ef4444] rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Value Distribution */}
      <div className="space-y-4 pt-2">
        <div className="text-[#999999] text-sm">仓位分布</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-lg font-bold">$ 0</span>
            <span className="text-[#999999] text-xs">多头价值</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-lg font-bold">$ 239,670,330.26</span>
            <span className="text-[#999999] text-xs">空头价值</span>
          </div>
        </div>
      </div>

      {/* ROI & PnL */}
      <div className="space-y-3 pt-4 border-t border-[#2c2c2c]">
        <div className="flex justify-between items-center">
          <span className="text-[#999999] text-sm">投资回报率</span>
          <span className="text-[#4ade80] text-base font-bold">+11.39 %</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#999999] text-sm">未实现盈亏</span>
          <span className="text-[#4ade80] text-base font-bold">$ +2,414,096.73</span>
        </div>
      </div>
    </div>
  );
};

