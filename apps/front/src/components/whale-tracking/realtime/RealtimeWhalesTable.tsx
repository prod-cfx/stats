'use client';

import { Copy, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import { PageTitle } from '@/components/ui/Typography';
import { fetchRealtimeWhaleAlerts } from '@/lib/api';
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
  timestamp: number; // Date.now() when transaction was created
}

const initialTransactions: WhaleTransaction[] = [];

export const RealtimeWhalesTable = () => {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [transactions, setTransactions] = useState<WhaleTransaction[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestIdRef = useRef(0);
  const { success, error } = useToast();

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
          // 实际胜率来自交易历史，这里先占位为 '--'
          winRate: '--',
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
        error(t('whaleTracking.realtime.toast.loadFailed'));
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [error, t]);

  // 首次挂载时立即拉取一次最新数据
  useEffect(() => {
    void fetchNewData();
  }, [fetchNewData]);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            fetchNewData();
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
  }, [isPaused, fetchNewData]);

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

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    success(t('whaleTracking.realtime.toast.copied'));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <PageTitle>{t('whaleTracking.realtime.title')}</PageTitle>
          <p className="text-xs text-[#8b949e]">{t('whaleTracking.realtime.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-full text-label font-bold transition-all active:scale-95 ${
              isPaused 
                ? 'bg-[#21262d] border-[#30363d] text-[#8b949e]' 
                : 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!isPaused ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <span>{isPaused ? t('whaleTracking.realtime.paused') : t('whaleTracking.realtime.nextUpdate', { count: countdown })}</span>
          </button>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[600px] relative shadow-2xl">
        {/* Realtime mini-loading indicator */}
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary animate-pulse z-30" />
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#8b949e] border-b border-[#30363d] bg-[#0d1117]/50">
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.address')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.asset')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.positionValue')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.entryPrice')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.winRate')}</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">{t('whaleTracking.realtime.table.time')}</th>
                <th className="px-6 py-4 text-center w-16">{t('whaleTracking.realtime.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {transactions.map((tx) => (
                <tr
                  key={`${tx.address}-${tx.asset}-${tx.positionAction}-${tx.timestamp}`}
                  className="hover:bg-[#1f2937]/50 transition-colors group cursor-pointer animate-in slide-in-from-left-2 duration-300"
                  onClick={() => handleShowStats(tx.address)}
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/whale-tracking/profile/?address=${tx.address}`}
                          className="text-white text-body font-medium hover:underline decoration-primary decoration-2 underline-offset-4 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {`${tx.address.slice(0, 6)}...${tx.address.slice(-4)}`}
                        </Link>
                        <button type="button" className="text-[#8b949e] hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); handleCopy(tx.address); }}>
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span 
                        className="w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{ color: tx.tagColor, backgroundColor: tx.tagBg }}
                      >
                        {t(`whaleTracking.tags.${tx.tagKey}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${tx.side === 'Long' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {tx.side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white text-body font-bold">{tx.asset}</span>
                        <span className="text-[#8b949e] text-[10px] uppercase">{tx.marginType === 'Cross' ? t('whaleTracking.margin.cross') : t('whaleTracking.margin.isolated')}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-body font-bold">{tx.positionValueUSD}</span>
                      <span className="text-[#8b949e] text-xs">{tx.positionValueAsset}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-white text-body font-mono">
                    {tx.entryPrice}
                  </td>
                  <td className="px-6 py-5 text-[#4ade80] text-body font-bold">
                    {tx.winRate}
                  </td>
                  <td className="px-6 py-5 text-[#8b949e] text-caption text-right font-medium">
                    {formatRelativeTime(tx.timestamp)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button 
                      type="button"
                      className="w-9 h-9 mx-auto flex items-center justify-center bg-[#0d1117] border border-[#30363d] rounded-xl text-[#8b949e] hover:text-white hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowStats(tx.address);
                      }}
                    >
                      <TrendingUp className="w-5 h-5" />
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
