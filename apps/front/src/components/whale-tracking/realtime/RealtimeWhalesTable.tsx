'use client';

import { ArrowUpDown, Check, ChevronDown, ChevronUp, Copy, RefreshCw, TrendingUp } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTitle } from '@/components/ui/Typography';
import { fetchRealtimeWhaleAlerts } from '@/lib/api';
import { toast } from '@/lib/toast';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

interface WhaleTransaction {
  address: string;
  tagKey: 'swing' | 'trend';
  tagColor: string;
  tagBg: string;
  asset: string;
  positionAction: number;
  side: 'Long' | 'Short';
  marginType: 'Cross' | 'Isolated';
  positionValueUSD: string;
  positionValueAsset: string;
  entryPrice: string;
  winRate: string;
  winRatePct: number; // for sorting
  timestamp: number; // Date.now() when transaction was created
}

const initialTransactions: WhaleTransaction[] = [];

export const RealtimeWhalesTable = () => {
  const { t } = useTranslation();
  const params = useParams();
  const lng = (params as any)?.lng ?? 'zh';
  const router = useRouter();
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [transactions, setTransactions] = useState<WhaleTransaction[]>(initialTransactions);
  const [_loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const fetchNewDataRef = useRef<(() => Promise<void>) | null>(null);

  const seededNumber = (input: string): number => {
    // simple non-cryptographic hash → [0, 1)
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 2 ** 32;
  };

  const formatRelativeTime = (timestamp: number) => {
    const minutesAgo = Math.floor((currentTime - timestamp) / 60_000);
    if (minutesAgo <= 0) return t('whaleTracking.time.justNow');
    if (minutesAgo < 60) return t('whaleTracking.time.minutesAgo', { count: minutesAgo });
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return t('whaleTracking.time.hoursAgo', { count: hoursAgo });
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo < 7) return t('whaleTracking.time.daysAgo', { count: daysAgo });
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 4) return t('whaleTracking.time.weeksAgo', { count: weeksAgo });
    const monthsAgo = Math.floor(daysAgo / 30);
    return t('whaleTracking.time.monthsAgo', { count: monthsAgo });
  };

  const fetchNewData = useCallback(async () => {
    // 防抖：如果当前已有请求在飞，直接跳过，避免计时器/重复挂载导致并发请求风暴
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    // 使用递增的请求 ID，避免并发请求导致旧数据覆盖新数据
    const requestId = ++lastRequestIdRef.current;

    try {
      setLoading(true);
      const alerts = await fetchRealtimeWhaleAlerts({
        // 默认展示名义价值 >= 100 万 USD 的最新 50 条记录
        minPositionValueUsd: 1_000_000,
        limit: 50,
      });

      const mapped: WhaleTransaction[] = alerts.map(alert => {
        const side = alert.side;
        const tagKey: WhaleTransaction['tagKey'] = alert.position_action === 1 ? 'swing' : 'trend';
        const tagStyle =
          tagKey === 'swing'
            ? { tagColor: '#60a5fa', tagBg: '#3b82f633' }
            : { tagColor: '#c084fc', tagBg: '#a855f733' };

        const positionValueNumber = Number(alert.position_value_usd);
        const positionValueUSD =
          Number.isFinite(positionValueNumber)
            ? `$${positionValueNumber.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}`
            : '$-';

        const absSize = Math.abs(alert.position_size);
        const sizeText =
          absSize >= 1 ? absSize.toFixed(4) : absSize.toPrecision(4);
        const signedQty = side === 'Short' ? `-${sizeText}` : sizeText;
        const positionValueAsset = `${signedQty} ${alert.symbol}`;

        const entryPriceNumber = Number(alert.entry_price);
        const entryPrice =
          Number.isFinite(entryPriceNumber)
            ? `$${entryPriceNumber.toLocaleString('en-US', {
                maximumFractionDigits: 1,
              })}`
            : '$-';

        const timestamp = new Date(alert.create_time).getTime();

        // 后端暂未提供胜率：先用“稳定伪随机”生成展示值（基于 address+symbol，不会抖动）
        const seedBase = `${alert.user_address}-${alert.symbol}`;
        const winRatePct = 45 + seededNumber(`${seedBase}-wr`) * 40; // [45, 85)

        return {
          address: alert.user_address,
          tagKey,
          tagColor: tagStyle.tagColor,
          tagBg: tagStyle.tagBg,
          asset: alert.symbol,
          positionAction: alert.position_action,
          side,
          // Hyperliquid / Coinglass 不暴露保证金类型，这里统一展示为 Cross
          marginType: 'Cross',
          positionValueUSD,
          positionValueAsset,
          entryPrice,
          winRate: `${winRatePct.toFixed(0)}%`,
          winRatePct,
          timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
        };
      });

      // 只在当前请求仍是最新时更新列表，避免并发请求造成“时间倒退”
      if (requestId === lastRequestIdRef.current) {
        setTransactions(mapped);
      }
    } catch (e) {
      // 加载失败时保留当前列表，并给出提示，仅对最新请求弹 toast，避免并发时旧请求误报
      console.error('Failed to fetch realtime whale alerts', e);
      if (requestId === lastRequestIdRef.current) {
        toast.error({ title: t('whaleTracking.realtime.toast.loadFailed') });
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false);
      }
      inFlightRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    fetchNewDataRef.current = fetchNewData;
  }, [fetchNewData]);

  // 首次挂载时立即拉取一次最新数据（避免 fetchNewData identity 变化导致重复拉取）
  useEffect(() => {
    void fetchNewDataRef.current?.();
     
  }, []);

  useEffect(() => {
    // 保险：每次 effect 触发前都清理一次旧 interval，防止 ref 被覆盖导致遗留定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            fetchNewDataRef.current?.();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  // Update currentTime every 10 seconds to refresh relative time display
  useEffect(() => {
    timeUpdateRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10_000);

    return () => {
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current);
    };
  }, []);

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  const handleCopy = async (address: string) => {
    if (copiedAddress === address) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const el = document.createElement('textarea');
        el.value = address;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '0';
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand('copy');
        el.remove();
        if (!ok) throw new Error('copy_failed');
      }
      setCopiedAddress(address);
      toast.success({ title: t('whaleTracking.realtime.toast.copied'), description: address, duration: 2000 });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Copy failed', err);
      toast.error({ title: t('common.error'), description: t('common.tryAgain'), duration: 2500 });
    }
  };

  const handleGoProfile = (address: string) => {
    router.push(`/${lng}/whale-tracking/profile?address=${encodeURIComponent(address)}`);
  };

  const handleSortWinRate = () => {
    setSortOrder(prev => {
      if (prev === 'desc') return 'asc';
      if (prev === 'asc') return null;
      return 'desc';
    });
  };

  const renderSortIcon = () => {
    if (!sortOrder) {
      return <ArrowUpDown className="w-4 h-4 text-[#8b949e] opacity-30 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />;
    }
    return sortOrder === 'desc'
      ? <ChevronDown className="w-4 h-4 text-primary ml-1 flex-shrink-0" />
      : <ChevronUp className="w-4 h-4 text-primary ml-1 flex-shrink-0" />;
  };

  const displayedTransactions = useMemo(() => {
    if (!sortOrder) return transactions;
    return [...transactions].sort((a, b) => {
      return sortOrder === 'desc' ? b.winRatePct - a.winRatePct : a.winRatePct - b.winRatePct;
    });
  }, [transactions, sortOrder]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <PageTitle className="text-xl md:text-2xl">{t('whaleTracking.realtime.title')}</PageTitle>
          <p className="text-[10px] md:text-xs text-[#8b949e]">{t('whaleTracking.realtime.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border rounded-full text-xs md:text-label font-bold transition-all active:scale-95 ${
              isPaused 
                ? 'bg-[#21262d] border-[#30363d] text-[#8b949e]' 
                : 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10'
            }`}
          >
            <RefreshCw className={`w-3 h-3 md:w-3.5 md:h-3.5 ${!isPaused ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <span>{isPaused ? t('whaleTracking.realtime.paused') : t('whaleTracking.realtime.nextUpdate', { count: countdown })}</span>
          </button>
        </div>
      </div>

      <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl overflow-hidden min-h-[600px] relative shadow-2xl">
        {/* Loading indicator removed per UX request (kept data fetching + logs) */}
        
        <div className="overflow-x-auto cf-scrollbar">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/50">
                <th className="px-3 md:px-6 py-4 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider sticky left-0 z-10 bg-[color:var(--cf-bg)]/95 border-r border-[color:var(--cf-border)]">{t('whaleTracking.realtime.table.address')}</th>
                <th className="px-3 md:px-6 py-4 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.asset')}</th>
                <th className="px-3 md:px-6 py-4 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.positionValue')}</th>
                <th className="px-3 md:px-6 py-4 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.entryPrice')}</th>
                <th className="px-3 md:px-6 py-4 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                  <button
                    type="button"
                    className="flex items-center cursor-pointer group select-none"
                    onClick={handleSortWinRate}
                  >
                    {t('whaleTracking.realtime.table.winRate')}
                    {renderSortIcon()}
                  </button>
                </th>
                <th className="px-3 md:px-6 py-4 text-right text-[10px] md:text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.time')}</th>
                <th className="px-3 md:px-6 py-4 text-center w-12 md:w-16">{t('whaleTracking.realtime.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--cf-border)]">
              {displayedTransactions.map((tx) => (
                <tr
                  key={`${tx.address}-${tx.asset}-${tx.positionAction}-${tx.timestamp}`}
                  className="hover:bg-[color:var(--cf-surface-hover)]/50 transition-colors group cursor-pointer"
                  onClick={() => handleShowStats(tx.address)}
                >
                  <td className="px-3 md:px-6 py-5 sticky left-0 z-10 bg-[color:var(--cf-surface)] border-r border-[color:var(--cf-border)] group-hover:bg-[color:var(--cf-surface-hover)]/50">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 relative group/address z-20">
                        <button
                          type="button"
                          className="text-left text-[color:var(--cf-text-strong)] text-[11px] md:text-body font-medium hover:underline decoration-primary decoration-2 underline-offset-4 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGoProfile(tx.address);
                          }}
                        >
                          {`${tx.address.slice(0, 4)}...${tx.address.slice(-4)}`}
                        </button>
                        {/* Hover-to-reveal full address tooltip */}
                        <div className="absolute left-0 top-0 -translate-y-[120%] z-30 px-3 py-2 rounded-lg shadow-2xl text-xs font-mono whitespace-nowrap bg-black/90 text-white dark:bg-white/90 dark:text-black border border-black/10 dark:border-white/10 pointer-events-none opacity-0 invisible group-hover/address:opacity-100 group-hover/address:visible transition-all duration-200">
                          {tx.address}
                          <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
                        </div>
                        <button 
                          type="button" 
                          className={`transition-colors ${copiedAddress === tx.address ? 'text-green-500' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
                          onClick={(e) => { e.stopPropagation(); handleCopy(tx.address); }}
                        >
                          {copiedAddress === tx.address ? <Check className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Copy className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                        </button>
                      </div>
                      <span 
                        className="w-fit px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase"
                        style={{ color: tx.tagColor, backgroundColor: tx.tagBg }}
                      >
                        {t(`whaleTracking.tags.${tx.tagKey}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 md:w-8 md:h-8 rounded md:rounded-lg flex items-center justify-center text-[10px] md:text-xs font-bold ${tx.side === 'Long' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {tx.side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[color:var(--cf-text-strong)] text-[11px] md:text-body font-bold">{tx.asset}</span>
                        <span className="text-[color:var(--cf-muted)] text-[8px] md:text-[10px] uppercase">{tx.marginType === 'Cross' ? t('whaleTracking.margin.cross') : t('whaleTracking.margin.isolated')}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[color:var(--cf-text-strong)] text-[11px] md:text-body font-bold">{tx.positionValueUSD}</span>
                      <span className="text-[color:var(--cf-muted)] text-[9px] md:text-xs">{tx.positionValueAsset}</span>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-5 text-[color:var(--cf-text-strong)] text-[11px] md:text-body font-mono">
                    {tx.entryPrice}
                  </td>
                  <td className="px-3 md:px-6 py-5 text-[#4ade80] text-[11px] md:text-body font-bold">
                    {tx.winRate}
                  </td>
                  <td className="px-3 md:px-6 py-5 text-[color:var(--cf-muted)] text-[10px] md:text-caption text-right font-medium">
                    {formatRelativeTime(tx.timestamp)}
                  </td>
                  <td className="px-3 md:px-6 py-5 text-center">
                    <button 
                      type="button"
                      className="w-7 h-7 md:w-9 md:h-9 mx-auto flex items-center justify-center bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded md:rounded-xl text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowStats(tx.address);
                      }}
                    >
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WhaleTradingStatsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  );
};
