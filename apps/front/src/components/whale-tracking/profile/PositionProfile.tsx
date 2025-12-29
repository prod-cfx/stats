'use client';

import React from 'react';

export const PositionProfile = () => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex flex-col gap-6 h-full">
      {/* Title */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[#8b949e] text-body font-medium">永续合约总价值</span>
          <span className="px-2 py-0.5 bg-[#30363d] text-[#8b949e] text-caption font-bold rounded uppercase">当前持仓</span>
        </div>
        <div className="text-white text-h1 font-bold tracking-tight">$ 31,034,500</div>
      </div>

      {/* Margin Usage Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[#8b949e] text-body">平均保证金使用率</span>
          <span className="text-[#e5e5e5] text-body font-bold">90.78 %</span>
        </div>
        <div className="h-1.5 w-full bg-[#0d1117] rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: '90.78%' }} />
        </div>
      </div>

      {/* Direction Bias */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-[#8b949e] text-body font-medium">方向偏差</span>
          <span className="text-[#8b949e] text-body font-medium">中性</span>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[#8b949e] text-body font-medium">多头持仓</span>
              <span className="text-green-500 text-body font-bold">0 %</span>
            </div>
            <div className="h-1.5 w-full bg-[#0d1117] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[#8b949e] text-body font-medium">空头持仓</span>
              <span className="text-red-500 text-body font-bold">100 %</span>
            </div>
            <div className="h-1.5 w-full bg-[#0d1117] rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Value Distribution */}
      <div className="flex flex-col gap-4">
        <div className="text-[#8b949e] text-body font-medium">仓位分布</div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[#8b949e] text-caption font-medium">多头价值</span>
            <span className="text-white text-h2 font-bold">$ 0</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[#8b949e] text-caption font-medium">空头价值</span>
            <span className="text-white text-h2 font-bold">$ 31,034,500</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
      </div>

      {/* ROI & PnL */}
      <div className="flex flex-col gap-3 pt-4 mt-auto border-t border-[#30363d]">
        <div className="flex justify-between items-center">
          <span className="text-[#8b949e] text-body">投资回报率</span>
          <span className="text-red-500 text-h2 font-bold">-7.63 %</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#8b949e] text-body">未实现盈亏</span>
          <span className="text-red-500 text-h2 font-bold">$ -54,885.83</span>
        </div>
      </div>
    </div>
  );
};

