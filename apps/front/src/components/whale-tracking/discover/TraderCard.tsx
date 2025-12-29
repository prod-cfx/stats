'use client';

import React from 'react';
import { Copy, ExternalLink, TrendingUp } from 'lucide-react';
import Link from 'next/link';

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
  onShowStats?: (address: string) => void;
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
  aiTags,
  onShowStats
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
                <Link 
                  href={`/whale-tracking/profile/${address}`}
                  className="text-white font-bold text-h3 hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
                >
                  {address}
                </Link>
                <button className="text-[#666666] hover:text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {tag && <span className="text-[#888888] text-caption font-medium uppercase">{tag}</span>}
            </div>
          </div>
          <button 
            className="w-9 h-9 flex items-center justify-center bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-[#aaaaaa] hover:text-white active:scale-95 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onShowStats?.(address);
            }}
          >
            <TrendingUp className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-caption font-medium">账户总价值</span>
            <span className="text-white font-bold text-h2">{totalValue}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-caption font-medium">已实现盈亏</span>
            <span className={`font-bold text-h2 ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
              {pnl}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-caption font-medium">交易次数</span>
            <span className="text-white font-bold text-h2">{trades}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[#888888] text-caption font-medium">胜率</span>
            <span className="text-white font-bold text-h2">{winRate}</span>
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
          <Link 
            href={`/whale-tracking/profile/${address}`}
            className="text-white font-bold text-h2 hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
          >
            {address}
          </Link>
          <button className="text-[#555555] hover:text-white transition-colors">
            <Copy className="w-4.5 h-4.5" />
          </button>
          {handle && <span className="text-[#555555] text-body font-medium ml-2">{handle}</span>}
        </div>
        <button 
          className="w-9 h-9 flex items-center justify-center bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-[#aaaaaa] hover:text-white active:scale-95 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onShowStats?.(address);
          }}
        >
          <TrendingUp className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#777777] text-caption font-medium">账户总价值</span>
        <span className="text-white text-h1 font-bold tracking-tight">{totalValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-[#222222] pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-caption font-bold uppercase tracking-wider">{pnlLabel}</span>
          <span className={`font-bold text-body ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {pnl}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-caption font-bold uppercase tracking-wider">当前持仓</span>
          <span className="text-white font-bold text-body">{positions}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#777777] text-caption font-bold uppercase tracking-wider">{winRateLabel}</span>
          <span className="text-white font-bold text-body">{winRate}</span>
        </div>
      </div>

      {aiTags && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#555555] text-caption font-bold uppercase tracking-tighter">AI标签:</span>
          {aiTags.map((t, i) => (
            <span 
              key={i} 
              className="px-2.5 py-1 rounded-md text-caption font-extrabold uppercase tracking-tight"
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
