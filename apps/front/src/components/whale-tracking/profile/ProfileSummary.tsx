'use client';

import React from 'react';
import { Info } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

export const ProfileSummary = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard 
        label="账户总价值" 
        value="$ 792,013.10" 
        chartData={[
          { value: 792013.09, name: '永续合约', itemStyle: { color: '#5470c6' } },
          { value: 0.01, name: '现货', itemStyle: { color: '#91cc75' } }
        ]}
        subText={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-caption text-[#999999]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5470c6]" />
              <span>永续合约</span>
              <span className="text-[#e5e5e5] ml-auto">$ 792,013.09</span>
            </div>
            <div className="flex items-center gap-2 text-caption text-[#999999]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#91cc75]" />
              <span>现货</span>
              <span className="text-[#e5e5e5] ml-auto">$ 0.01</span>
            </div>
          </div>
        }
      />
      <SummaryCard 
        label="可用保证金" 
        value="$ 73,015.45" 
        chartData={[
          { value: 9.22, name: '已用', itemStyle: { color: '#fac858' } },
          { value: 90.78, name: '可用', itemStyle: { color: '#3a3a3a' } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-caption text-[#999999]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span>可提取</span>
            <span className="text-[#e5e5e5] ml-auto">9.22 %</span>
          </div>
        }
      />
      <SummaryCard 
        label="总持仓价值" 
        value="$ 31,034,500" 
        chartData={[
          { value: 100, name: '空头', itemStyle: { color: '#fac858' } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-caption text-[#999999]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span>杠杆比</span>
            <Info className="w-3 h-3 text-[#555555]" />
            <span className="text-[#e5e5e5] ml-auto">39.18x</span>
          </div>
        }
      />
      <SummaryCard 
        label="交易表现 (1周)" 
        isPerformance
        stats={[
          { label: '胜率', value: '28.57 %', sub: '已成交订单', subVal: '77' },
          { label: '最大回撤', value: '59.03 %', sub: '平仓次数', subVal: '7' }
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
  chartData?: any[];
  stats?: { label: string; value: string; sub: string; subVal: string }[];
}

const SummaryCard = ({ label, value, subText, isPerformance, chartData, stats }: SummaryCardProps) => {
  const chartOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'pie',
        radius: ['60%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { scale: false },
        labelLine: { show: false },
        data: chartData || []
      }
    ]
  };

  return (
    <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl p-5 flex flex-col gap-4 relative min-h-[160px]">
      <div className="text-[#999999] text-label font-medium">{label}</div>
      {isPerformance ? (
        <div className="flex flex-col gap-4 mt-auto">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-[#999999] text-caption font-medium">胜率</span>
              <span className="text-white text-h2 font-bold">28.57 %</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#999999] text-caption font-medium">最大回撤</span>
              <span className="text-white text-h2 font-bold">59.03 %</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[#999999] text-caption font-medium">已成交订单</span>
              <span className="text-white text-body font-bold ml-auto">77</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[#999999] text-caption font-medium">平仓次数</span>
              <span className="text-white text-body font-bold ml-auto">7</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-2.5 flex-1">
            <div className="text-white text-h2 font-bold tracking-tight">{value}</div>
            <div className="w-full">{subText}</div>
          </div>
          <div className="w-16 h-16 flex-none ml-4">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
};

