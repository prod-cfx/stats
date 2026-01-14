'use client';

import { Check, Copy, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTitle } from '@/components/ui/Typography';

interface ProfileHeaderProps {
  address: string;
}

export const ProfileHeader = ({ address }: ProfileHeaderProps) => {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const copyTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const handleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setIsRefreshing(true);
    refreshTimer.current = setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleCopyAddress = async () => {
    try {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
      copyTimer.current = setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const tags: Array<{ key: 'midCapital' | 'bearBias' | 'breakeven' | 'volatility' | 'shortTerm'; color: string; bg: string }> = [
    { key: 'midCapital', color: 'text-primary', bg: 'bg-primary/10' },
    { key: 'bearBias', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { key: 'breakeven', color: 'text-gray-400', bg: 'bg-gray-400/10' },
    { key: 'volatility', color: 'text-teal-400', bg: 'bg-teal-400/10' },
    { key: 'shortTerm', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#2c2c2c] flex items-center justify-center border border-[#30363d] overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`} alt="avatar" className="w-full h-full" />
          </div>
          <div className="flex items-center gap-3">
            <PageTitle className="text-xl md:text-2xl">{formatAddress(address)}</PageTitle>
          <button 
            type="button" 
            onClick={handleCopyAddress}
            className={`transition-colors ${isCopied ? 'text-green-400' : 'text-[#8b949e] hover:text-white'}`}
            title={t('whaleTracking.profile.header.copyAddress')}
          >
            {isCopied ? <Check className="w-4 h-4 md:w-4.5 md:h-4.5" /> : <Copy className="w-4 h-4 md:w-4.5 md:h-4.5" />}
          </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag, idx) => (
            <span 
              key={idx} 
              className={`px-2 py-0.5 rounded text-[10px] md:text-caption font-bold tracking-tight ${tag.color} ${tag.bg}`}
            >
              {t(`whaleTracking.tags.${tag.key}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          type="button" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-xl text-[#e5e5e5] text-xs md:text-label font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all group ${isRefreshing ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
        >
          <RefreshCw className={`w-4 h-4 md:w-4.5 md:h-4.5 text-[#8b949e] group-hover:text-white transition-all ${isRefreshing ? 'animate-spin text-white' : ''}`} />
          <span className={`text-sm md:text-body font-bold text-white transition-colors`}>{isRefreshing ? t('whaleTracking.profile.header.refreshing') : t('whaleTracking.profile.header.realtimeData')}</span>
        </button>
      </div>
    </div>
  );
};

