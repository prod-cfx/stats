'use client';

import { Copy, Info, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface TraderCardProps {
  variant: 'recommended' | 'detail';
  address: string;
  handle?: string | null;
  tag?: string | null;
  totalValueUsd: number;
  pnlUsd: number;
  pnlLabelKey?: 'realizedPnl' | 'realizedPnl1m';
  trades?: number;
  positions?: number;
  winRatePct: number; // 0-100
  winRateLabelKey?: 'winRate' | 'winRate1m';
  avatarColor: string;
  aiTags?: {
    key: 'bullWarGod' | 'swingKing' | 'smartTrader' | 'treasuryKeeper' | 'twitterKol'
    color: string
    bgColor: string
    descriptionKey?: 'bullWarGod' | 'swingKing' | 'smartTrader' | 'treasuryKeeper' | 'twitterKol'
  }[];
  onShowStats?: (address: string) => void;
}

export const TraderCard = ({
  variant,
  address,
  handle,
  tag,
  totalValueUsd,
  pnlUsd,
  pnlLabelKey = 'realizedPnl',
  trades,
  positions,
  winRatePct,
  winRateLabelKey = 'winRate',
  avatarColor,
  aiTags,
  onShowStats
}: TraderCardProps) => {
  const { t, i18n } = useTranslation();
  const isPnlPositive = pnlUsd >= 0;

  const currencyCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const percentFormatter = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 })
  }, [i18n.language])

  const resolvedPnlLabel = t(`whaleTracking.discover.labels.${pnlLabelKey}`)
  const resolvedWinRateLabel = t(`whaleTracking.discover.labels.${winRateLabelKey}`)

  const resolvedTotalValue = currencyCompact.format(totalValueUsd)
  const resolvedPnl = pnlUsd >= 0 ? `+${currencyCompact.format(pnlUsd)}` : currencyCompact.format(pnlUsd)
  const resolvedWinRate = percentFormatter.format(winRatePct / 100)

  const resolveAiTagLabel = (key: NonNullable<TraderCardProps['aiTags']>[number]['key']) =>
    t(`whaleTracking.discover.aiTags.${key}`)

  const resolveAiTagDescription = (
    key: NonNullable<TraderCardProps['aiTags']>[number]['key'],
    descriptionKey?: NonNullable<TraderCardProps['aiTags']>[number]['descriptionKey'],
  ) => {
    if (descriptionKey)
      return t(`whaleTracking.discover.aiTagDescriptions.${descriptionKey}`)
    return t('whaleTracking.discover.labels.aiTagFallback', { label: resolveAiTagLabel(key) })
  };

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
          <span className="text-[#8b949e] text-caption font-medium">{t('whaleTracking.discover.labels.totalValue')}</span>
          <span className="text-white font-bold text-h3">{resolvedTotalValue}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">{t('whaleTracking.discover.labels.realizedPnl')}</span>
          <span className={`font-bold text-h3 ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {resolvedPnl}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">{t('whaleTracking.discover.labels.trades')}</span>
          <span className="text-white font-bold text-h3">{trades}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[#8b949e] text-caption font-medium">{t('whaleTracking.discover.labels.winRate')}</span>
          <span className="text-white font-bold text-h3">{resolvedWinRate}</span>
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
        <span className="text-[#8b949e] text-caption font-medium">{t('whaleTracking.discover.labels.totalValue')}</span>
        <span className="text-white text-h2 font-bold tracking-tight">{resolvedTotalValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-[#30363d] pb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">{resolvedPnlLabel}</span>
          <span className={`font-bold text-body ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {resolvedPnl}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">{t('whaleTracking.discover.labels.positions')}</span>
          <span className="text-white font-bold text-body">{positions}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-wider">{resolvedWinRateLabel}</span>
          <span className="text-white font-bold text-body">{resolvedWinRate}</span>
        </div>
      </div>

      {aiTags && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#8b949e] text-caption font-bold uppercase tracking-tighter">{t('whaleTracking.discover.labels.aiTags')}:</span>
          {aiTags.map((tag, i) => (
            <div key={i} className="relative group/tag">
              <span 
                className="px-2.5 py-1 rounded-md text-caption font-extrabold uppercase tracking-tight flex items-center gap-1 cursor-help"
                style={{ color: tag.color, backgroundColor: tag.bgColor }}
              >
                {resolveAiTagLabel(tag.key)}
                <Info className="w-3 h-3 opacity-50" />
              </span>
              {/* Simple CSS Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl text-[10px] text-[#e6edf3] whitespace-nowrap opacity-0 invisible group-hover/tag:opacity-100 group-hover/tag:visible transition-all z-20 pointer-events-none">
                {resolveAiTagDescription(tag.key, tag.descriptionKey)}
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
