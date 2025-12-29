'use client';

import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { PageTitle } from '@/components/ui/Typography';

interface ProfileHeaderProps {
  address: string;
}

export const ProfileHeader = ({ address }: ProfileHeaderProps) => {
  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const tags = [
    { label: '中等资金', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: '偏空头', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { label: '盈亏平衡', color: 'text-gray-400', bg: 'bg-gray-400/10' },
    { label: '波动策略', color: 'text-teal-400', bg: 'bg-teal-400/10' },
    { label: '短线', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#2c2c2c] flex items-center justify-center border border-[#30363d] overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`} alt="avatar" className="w-full h-full" />
          </div>
          <div className="flex items-center gap-3">
            <PageTitle>{formatAddress(address)}</PageTitle>
            <button className="text-[#666666] hover:text-white transition-colors">
              <Copy className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {tags.map((tag, idx) => (
            <span 
              key={idx} 
              className={`px-2 py-0.5 rounded text-caption font-bold tracking-tight ${tag.color} ${tag.bg}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-transparent text-[#e5e5e5] text-label font-medium hover:text-white transition-all group">
          <RefreshCw className="w-4.5 h-4.5 text-[#888888] group-hover:text-white transition-colors" />
          <span className="text-body font-bold">实时数据</span>
        </button>
      </div>
    </div>
  );
};

