'use client';

import React from 'react';
import { Copy, ExternalLink, TrendingUp } from 'lucide-react';

export interface TraderCardProps {
  variant: 'recommended' | 'detail';
  address: string;
  handle?: string;
  tag?: string;
  totalValue: string;
  pnl: string;
  pnlLabel?: string;
  trades?: number;
  positions?: number;
  winRate: string;
  winRateLabel?: string;
  avatarColor: string;
  aiTags?: { label: string; color: string; bgColor: string }[];
}

export const TraderCard = ({
  variant,
  address,
  handle,
  tag,
  totalValue,
  pnl,
  pnlLabel = '已实现盈亏',
  trades,
  positions,
  winRate,
  winRateLabel = '胜率',
  avatarColor,
  aiTags
}: TraderCardProps) => {
  const isPnlPositive = pnl.startsWith('+');

  if (variant === 'recommended') {
    return (
      <div className="bg-[#1c1c1c] border border-[#2c2c2c] rounded-2xl p-6 flex flex-col gap-6 hover:border-[#3b82f6]/50 transition-all group">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: `${avatarColor}33`, color: avatarColor }}>
              {address.substring(2, 4).toUpperCase()}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-lg">{address}</span>
                <button className="text-[#666666] hover:text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {tag && <span className="text-[#888888] text-xs font-medium tracking-tight uppercase">{tag}</span>}
            </div>
          </div>
          <button className="w-9 h-9 flex items-center justify-center bg-[#262626] border border-[#333333] rounded-xl text-[#888888] group-hover:text-white transition-colors">
            <ExternalLink className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-xs font-medium">账户总价值</span>
            <span className="text-white font-bold text-base">{totalValue}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-xs font-medium">已实现盈亏</span>
            <span className={`font-bold text-base ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
              {pnl}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-xs font-medium">交易次数</span>
            <span className="text-white font-bold text-base">{trades}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-xs font-medium">胜率</span>
            <span className="text-white font-bold text-base">{winRate}</span>
          </div>
        </div>
      </div>
    );
  }

  // Detail variant
  return (
    <div className="bg-[#121212] border border-[#222222] rounded-2xl p-6 flex flex-col gap-6 hover:border-[#3b82f6]/30 transition-all group">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xl">{address}</span>
          <button className="text-[#555555] hover:text-white transition-colors">
            <Copy className="w-4.5 h-4.5" />
          </button>
          {handle && <span className="text-[#555555] text-sm font-medium ml-2">{handle}</span>}
        </div>
        <button className="w-9 h-9 flex items-center justify-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#555555] group-hover:text-white transition-colors">
          <TrendingUp className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#777777] text-xs font-medium">账户总价值</span>
        <span className="text-white text-4xl font-extrabold tracking-tight">{totalValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-[#222222] pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-[10px] font-bold uppercase tracking-wider">{pnlLabel}</span>
          <span className={`font-bold text-sm ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {pnl}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-[10px] font-bold uppercase tracking-wider">当前持仓</span>
          <span className="text-white font-bold text-sm">{positions}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-[10px] font-bold uppercase tracking-wider">{winRateLabel}</span>
          <span className="text-white font-bold text-sm">{winRate}</span>
        </div>
      </div>

      {aiTags && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#555555] text-xs font-bold uppercase tracking-tighter">AI标签:</span>
          {aiTags.map((t, i) => (
            <span 
              key={i} 
              className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-tight"
              style={{ color: t.color, backgroundColor: t.bgColor }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
