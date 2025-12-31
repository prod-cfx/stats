'use client';

import { ChevronDown } from 'lucide-react';
import React from 'react';
import { SubTitle } from '@/components/ui/Typography';

interface VolumeItem {
  name: string;
  amount: string;
  percent: number; // 0-100
  color: string;
}

interface VolumeComparisonCardProps {
  title: string;
  symbol: string;
  items: VolumeItem[];
}

const VolumeComparisonCard: React.FC<VolumeComparisonCardProps> = ({ title, symbol, items }) => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-6 shadow-xl h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <SubTitle>{title}</SubTitle>
        <button className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm font-medium text-[#8b949e] hover:border-[#8b949e] transition-all">
          <span>{symbol}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Rows List */}
      <div className="flex flex-col gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 group">
            {/* Name */}
            <span className="w-24 text-sm font-medium text-[#8b949e] group-hover:text-[#e6edf3] transition-colors">
              {item.name}
            </span>

            {/* Progress Bar Container */}
            <div className="flex-1 h-2 bg-[#0d1117] rounded-full overflow-hidden relative border border-white/5">
              <div 
                className="h-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${item.percent}%`, 
                  backgroundColor: item.color,
                  boxShadow: `0 0 10px ${item.color}40`
                }}
              />
            </div>

            {/* Amount */}
            <span className="w-24 text-right text-sm font-bold text-[#e6edf3]">
              {item.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AggregatedVolume = () => {
  const btcItems: VolumeItem[] = [
    { name: 'Total', amount: '$44.59B', percent: 100, color: '#3b82f6' },
    { name: 'MEXC', amount: '$12.89B', percent: 28.9, color: '#a855f7' },
    { name: 'OKX', amount: '$8.55B', percent: 19.2, color: '#f43f5e' },
    { name: 'Bybit', amount: '$6.53B', percent: 14.6, color: '#eab308' },
    { name: 'Bitget', amount: '$4.82B', percent: 10.8, color: '#22c55e' },
    { name: 'BingX', amount: '$2.99B', percent: 6.7, color: '#06b6d4' },
    { name: 'Bitunix', amount: '$1.91B', percent: 4.3, color: '#6366f1' },
    { name: 'Hyperliquid', amount: '$1.40B', percent: 3.1, color: '#8b5cf6' },
    { name: 'Aster', amount: '$1.33B', percent: 3.0, color: '#ef4444' },
    { name: 'KuCoin', amount: '$1.33B', percent: 3.0, color: '#f59e0b' },
    { name: 'LBank', amount: '$840.00M', percent: 1.9, color: '#10b981' },
    { name: 'Lighter', amount: '$1.00B', percent: 2.2, color: '#0ea5e9' },
  ];

  const ethItems: VolumeItem[] = [
    { name: 'Total', amount: '$38.24B', percent: 100, color: '#3b82f6' },
    { name: 'MEXC', amount: '$9.51B', percent: 24.9, color: '#a855f7' },
    { name: 'OKX', amount: '$8.20B', percent: 21.4, color: '#f43f5e' },
    { name: 'Bybit', amount: '$5.31B', percent: 13.9, color: '#eab308' },
    { name: 'Bitget', amount: '$3.80B', percent: 9.9, color: '#22c55e' },
    { name: 'BingX', amount: '$2.72B', percent: 7.1, color: '#06b6d4' },
    { name: 'Bitunix', amount: '$2.44B', percent: 6.4, color: '#6366f1' },
    { name: 'Hyperliquid', amount: '$1.65B', percent: 4.3, color: '#8b5cf6' },
    { name: 'KuCoin', amount: '$1.65B', percent: 4.3, color: '#f59e0b' },
    { name: 'Aster', amount: '$1.39B', percent: 3.6, color: '#ef4444' },
    { name: 'LBank', amount: '$1.39B', percent: 3.6, color: '#10b981' },
    { name: 'Lighter', amount: '$1.18B', percent: 3.1, color: '#0ea5e9' },
  ];

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
        <VolumeComparisonCard 
          title="BTC 合约成交额" 
          symbol="BTC" 
          items={btcItems} 
        />
        <VolumeComparisonCard 
          title="ETH 合约成交额" 
          symbol="ETH" 
          items={ethItems} 
        />
      </div>
    </div>
  );
};
