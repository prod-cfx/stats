'use client';

import React from 'react';

interface LiquidationCardProps {
  title: string;
  total: string;
  long: string;
  short: string;
}

const LiquidationCard = ({ title, total, long, short }: LiquidationCardProps) => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex-1 min-w-[260px]">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[#8b949e] text-base">{title}</span>
        <span className="text-white text-xl font-bold">{total}</span>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#8b949e]">多单</span>
          <span className="text-[#4ade80] font-medium">{long}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#8b949e]">空单</span>
          <span className="text-[#f87171] font-medium">{short}</span>
        </div>
      </div>
    </div>
  );
};

export const LiquidationSummary = () => {
  const summaryData = [
    { title: '1小时爆仓', total: '$2827.10万', long: '$2755.48万', short: '$71.62万' },
    { title: '4小时爆仓', total: '$3659.74万', long: '$3071.89万', short: '$587.85万' },
    { title: '12小时爆仓', total: '$1.35亿', long: '$1.17亿', short: '$1809.36万' },
    { title: '24小时爆仓', total: '$2.22亿', long: '$1.44亿', short: '$7842.77万' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">总爆仓</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryData.map((data, index) => (
          <LiquidationCard key={index} {...data} />
        ))}
      </div>
    </div>
  );
};

