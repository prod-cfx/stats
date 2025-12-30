'use client';

import { Copy, Info, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

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
  aiTags?: { label: string; color: string; bgColor: string; description?: string }[];
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

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(address);
  };

  const content = variant === 'recommended' ? (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-6 gradient-border-hover group cursor-pointer h-full" onClick={() => onShowStats?.(address)}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: `${avatarColor}33`, color: avatarColor }}>
            {address.substring(2, 4).toUpperCase() || 'WH'}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Link 
                href={`/whale-tracking/profile/?address=${address}`}
                className="text-white font-bold text-h3 hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                {address.length > 15 ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address}
              </Link>
              <button type="button" className="text-[#8b949e] hover:text-white transition-colors" onClick={copyAddress}>
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {tag && <span className="text-[#8b949e] text-caption font-medium uppercase">{tag}</span>}
          </div>
        </div>
        <button 
          type="button"
          className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#30363d] rounded-xl text-[#8b949e] hover:text-white active:scale-95 transition-all"
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
          <span className="text-[#8b949e] text-caption font-medium">账户总价值</span>
          <span className="text-white font-bold text-h2">{totalValue}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">已实现盈亏</span>
          <span className={`font-bold text-h2 ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {pnl}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">交易次数</span>
          <span className="text-white font-bold text-h2">{trades}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">胜率</span>
          <span className="text-white font-bold text-h2">{winRate}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-6 gradient-border-hover group cursor-pointer h-full" onClick={() => onShowStats?.(address)}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <Link 
            href={`/whale-tracking/profile/?address=${address}`}
            className="text-white font-bold text-h2 hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {address.length > 15 ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address}
          </Link>
          <button type="button" className="text-[#8b949e] hover:text-white transition-colors" onClick={copyAddress}>
            <Copy className="w-4.5 h-4.5" />
          </button>
          {handle && <span className="text-[#8b949e] text-body font-medium ml-2">{handle}</span>}
        </div>
        <button 
          type="button"
          className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#30363d] rounded-xl text-[#8b949e] hover:text-white active:scale-95 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onShowStats?.(address);
          }}
        >
          <TrendingUp className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#8b949e] text-caption font-medium">账户总价值</span>
        <span className="text-white text-h1 font-bold tracking-tight">{totalValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-[#30363d] pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">{pnlLabel}</span>
          <span className={`font-bold text-body ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {pnl}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">当前持仓</span>
          <span className="text-white font-bold text-body">{positions}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">{winRateLabel}</span>
          <span className="text-white font-bold text-body">{winRate}</span>
        </div>
      </div>

      {aiTags && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-tighter">AI标签:</span>
          {aiTags.map((t, i) => (
            <div key={i} className="relative group/tag">
              <span 
                className="px-2.5 py-1 rounded-md text-caption font-extrabold uppercase tracking-tight flex items-center gap-1 cursor-help"
                style={{ color: t.color, backgroundColor: t.bgColor }}
              >
                {t.label}
                <Info className="w-3 h-3 opacity-50" />
              </span>
              {/* Simple CSS Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl text-[10px] text-[#e6edf3] whitespace-nowrap opacity-0 invisible group-hover/tag:opacity-100 group-hover/tag:visible transition-all z-20 pointer-events-none">
                {t.description || `${t.label}：基于多维度链上行为分析得出的特征标签`}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#30363d]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return content;
};
