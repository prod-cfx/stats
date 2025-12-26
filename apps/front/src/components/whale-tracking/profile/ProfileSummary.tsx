'use client';

import React from 'react';
import { Info } from 'lucide-react';

export const ProfileSummary = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard 
        label="账户总价值" 
        value="$ 23,749,879.11" 
        subText={
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs text-[#999999]">
              <span>永续合约</span>
              <span className="text-[#e5e5e5]">$ 23,749,878.96</span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#999999]">
              <span>现货</span>
              <span className="text-[#e5e5e5]">$ 0.15</span>
            </div>
          </div>
        }
      />
      <SummaryCard 
        label="可用保证金" 
        value="$ 0" 
        subText={
          <div className="text-xs text-[#999999]">
            可提取 <span className="text-[#e5e5e5]">0.00 %</span>
          </div>
        }
      />
      <SummaryCard 
        label="总持仓价值" 
        value="$ 239,670,330.26" 
        subText={
          <div className="flex items-center gap-2 text-xs text-[#999999]">
            <span>杠杆比</span>
            <span className="text-[#e5e5e5]">10.09x</span>
            <Info className="w-3 h-3 text-[#555555]" />
          </div>
        }
      />
      <SummaryCard 
        label="交易表现 (1周)" 
        isPerformance
        stats={[
          { label: '胜率', value: '50.00 %', sub: '已成交订单 472' },
          { label: '最大回撤', value: '19.81 %', sub: '平均次数 10' }
        ]}
      />
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value?: string;
  subText?: React.ReactNode;
  isPerformance?: boolean;
  stats?: { label: string; value: string; subText?: string; sub?: string }[];
}

const SummaryCard = ({ label, value, subText, isPerformance, stats }: SummaryCardProps) => (
  <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl p-5 flex flex-col gap-4">
    <div className="text-[#999999] text-sm font-medium">{label}</div>
    {isPerformance ? (
      <div className="grid grid-cols-2 gap-4">
        {stats?.map((stat, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <div className="flex flex-col">
              <span className="text-[#999999] text-xs font-medium mb-0.5">{stat.label}</span>
              <span className="text-white text-lg font-bold">{stat.value}</span>
            </div>
            <div className="text-[10px] text-[#555555] font-medium uppercase tracking-wider">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <>
        <div className="text-white text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-auto">{subText}</div>
      </>
    )}
  </div>
);

