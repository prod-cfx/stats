'use client';

import { Check, Copy, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { PageTitle } from '@/components/ui/Typography';

interface ProfileHeaderProps {
  address: string;
}

export const ProfileHeader = ({ address }: ProfileHeaderProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      alert('复制地址失败');
    }
  };

  const tags = [
    { label: '中等资金', color: 'text-primary', bg: 'bg-primary/10' },
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
          <button 
            type="button" 
            onClick={handleCopyAddress}
            className={`transition-colors ${isCopied ? 'text-green-400' : 'text-[#8b949e] hover:text-white'}`}
            title="复制地址"
          >
            {isCopied ? <Check className="w-4.5 h-4.5" /> : <Copy className="w-4.5 h-4.5" />}
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
        <button 
          type="button" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-xl text-[#e5e5e5] text-label font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all group ${isRefreshing ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
        >
          <RefreshCw className={`w-4.5 h-4.5 text-[#8b949e] group-hover:text-white transition-all ${isRefreshing ? 'animate-spin text-white' : ''}`} />
          <span className={`text-body font-bold text-white transition-colors`}>{isRefreshing ? '更新中...' : '实时数据'}</span>
        </button>
      </div>
    </div>
  );
};

