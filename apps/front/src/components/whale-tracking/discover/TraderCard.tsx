'use client';

import { Check, Copy, Info, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';

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

const TAG_STYLES: Record<string, { colorClass: string, bgClass: string }> = {
  bullWarGod: {
    colorClass: 'text-blue-500 dark:text-blue-300',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30'
  },
  swingKing: {
    colorClass: 'text-purple-500 dark:text-purple-300',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30'
  },
  smartTrader: {
    colorClass: 'text-yellow-600 dark:text-yellow-300',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  treasuryKeeper: {
    colorClass: 'text-amber-600 dark:text-amber-300',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30'
  },
  twitterKol: {
    colorClass: 'text-sky-500 dark:text-sky-300',
    bgClass: 'bg-sky-100 dark:bg-sky-900/30'
  }
};

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
  const params = useParams();
  const lng = (params as any)?.lng ?? (i18n.language?.startsWith('zh') ? 'zh' : 'en');
  const isPnlPositive = pnlUsd >= 0;
  const isZh = String(lng).startsWith('zh')

  const tr = useCallback((key: string, fallbackZh: string, fallbackEn: string) => {
    const v = t(key)
    if (!v || v === key) return isZh ? fallbackZh : fallbackEn
    return v
  }, [isZh, t])

  const [hasCopied, setHasCopied] = useState(false)

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
  const avatarStyle = useMemo(() => ({
    backgroundColor: `${avatarColor}33`,
    color: avatarColor,
  }), [avatarColor])

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

  const copyAddress = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (hasCopied) return;

    const tryClipboard = async () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address)
        return true
      }
      return false
    }

    const fallbackCopy = () => {
      try {
        const el = document.createElement('textarea')
        el.value = address
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        el.style.top = '0'
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        el.remove()
        return ok
      } catch {
        return false
      }
    }

    try {
      const ok = await tryClipboard()
      if (!ok) {
        const fallbackOk = fallbackCopy()
        if (!fallbackOk) throw new Error('copy_failed')
      }
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
      toast.success({ title: tr('common.copied', '已复制', 'Copied'), description: address, duration: 2000 })
    } catch {
      toast.error({ title: tr('common.error', '复制失败', 'Copy failed'), description: tr('common.tryAgain', '请重试', 'Please try again'), duration: 2500 })
    }
  }, [address, hasCopied, tr]);

  const handleAddressClick = useCallback((e: React.MouseEvent) => {
    // Prevent card click event but allow navigation
    e.stopPropagation()
  }, [])

  const content = variant === 'recommended' ? (
    <div className="gradient-border-hover group flex h-full cursor-pointer flex-col gap-4 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:gap-5" onClick={() => onShowStats?.(address)}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex min-w-0 items-center gap-3 overflow-visible md:gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full !text-sm !font-semibold !leading-[22px] md:h-11 md:w-11" style={avatarStyle}>
            {address.substring(2, 4).toUpperCase() || 'WH'}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0 relative group/address">
              <Link 
                href={`/${lng}/whale-tracking/profile/?address=${address}`}
                className="truncate !text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)] underline-offset-4 transition-colors hover:text-primary"
                onClick={handleAddressClick}
              >
                {address.length > 12 ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address}
              </Link>
              {/* Hover-to-reveal full address tooltip */}
              <div className="invisible pointer-events-none absolute top-0 left-0 z-30 -translate-y-[120%] rounded-lg border border-black/10 bg-black/90 px-3 py-2 font-mono !text-xs !font-normal !leading-5 whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/address:visible group-hover/address:opacity-100 dark:border-white/10 dark:bg-white/90 dark:text-black">
                {address}
                <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
              </div>
              <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors flex-shrink-0" onClick={copyAddress}>
                {hasCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {tag && <span className="text-[color:var(--cf-muted)] text-caption font-medium uppercase truncate">{tag}</span>}
          </div>
        </div>
        <button 
          type="button"
          className="ml-2 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
          onClick={(e) => {
            e.stopPropagation();
            onShowStats?.(address);
          }}
        >
          <TrendingUp className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[color:var(--cf-muted)] text-caption font-medium">{t('whaleTracking.discover.labels.totalValue')}</span>
          <span className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{resolvedTotalValue}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[color:var(--cf-muted)] text-caption font-medium">{t('whaleTracking.discover.labels.realizedPnl')}</span>
          <span className={`!text-[15px] !font-semibold !leading-[22px] ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {resolvedPnl}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[color:var(--cf-muted)] text-caption font-medium">{t('whaleTracking.discover.labels.trades')}</span>
          <span className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{trades}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[color:var(--cf-muted)] text-caption font-medium">{t('whaleTracking.discover.labels.winRate')}</span>
          <span className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{resolvedWinRate}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="gradient-border-hover group flex h-full cursor-pointer flex-col gap-4 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 md:gap-5" onClick={() => onShowStats?.(address)}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 relative group/address">
          <Link 
            href={`/${lng}/whale-tracking/profile/?address=${address}`}
            className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)] underline-offset-4 transition-colors hover:text-primary"
            onClick={handleAddressClick}
          >
            {address.length > 15 ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address}
          </Link>
          {/* Hover-to-reveal full address tooltip */}
          <div className="invisible pointer-events-none absolute top-0 left-0 z-30 -translate-y-[120%] rounded-lg border border-black/10 bg-black/90 px-3 py-2 font-mono !text-xs !font-normal !leading-5 whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/address:visible group-hover/address:opacity-100 dark:border-white/10 dark:bg-white/90 dark:text-black">
            {address}
            <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
          </div>
          <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors flex-shrink-0" onClick={copyAddress}>
            {hasCopied ? <Check className="w-4.5 h-4.5 text-green-500" /> : <Copy className="w-4.5 h-4.5" />}
          </button>
          {handle && <span className="min-w-0 break-all !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)] md:ml-2">{handle}</span>}
        </div>
        <button 
          type="button"
          className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
          onClick={(e) => {
            e.stopPropagation();
            onShowStats?.(address);
          }}
        >
          <TrendingUp className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[color:var(--cf-muted)] text-caption font-medium">{t('whaleTracking.discover.labels.totalValue')}</span>
        <span className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">{resolvedTotalValue}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-[color:var(--cf-border)] pb-5 sm:grid-cols-3 md:gap-2 md:pb-6">
        <div className="flex flex-col gap-1">
          <span className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">{resolvedPnlLabel}</span>
          <span className={`!text-sm !font-semibold !leading-[22px] ${isPnlPositive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {resolvedPnl}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">{t('whaleTracking.discover.labels.positions')}</span>
          <span className="!text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{positions}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">{resolvedWinRateLabel}</span>
          <span className="!text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{resolvedWinRate}</span>
        </div>
      </div>

      {aiTags && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">{t('whaleTracking.discover.labels.aiTags')}:</span>
          {aiTags.map((tag, i) => {
            const styles = TAG_STYLES[tag.key] || { colorClass: 'text-[color:var(--cf-text-strong)]', bgClass: 'bg-[color:var(--cf-surface-2)]' };
            return (
              <div key={i} className="relative group/tag">
                <span 
                  className={`flex cursor-help items-center gap-1 rounded-md px-2.5 py-1 !text-xs !font-semibold !leading-5 ${styles.colorClass} ${styles.bgClass}`}
                >
                  {resolveAiTagLabel(tag.key)}
                  <Info className="w-3 h-3 opacity-50" />
                </span>
                {/* Simple CSS Tooltip */}
                <div className="invisible pointer-events-none absolute bottom-full left-0 z-20 mb-2 max-w-[220px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2 text-[10px] text-[color:var(--cf-text)] whitespace-normal opacity-0 shadow-sm transition-opacity group-hover/tag:visible group-hover/tag:opacity-100 md:left-1/2 md:max-w-none md:-translate-x-1/2 md:whitespace-nowrap">
                  {resolveAiTagDescription(tag.key, tag.descriptionKey)}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[color:var(--cf-border)]" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );

  return content;
};
