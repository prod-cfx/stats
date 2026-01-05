'use client';

import { Copy, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import { PageTitle } from '@/components/ui/Typography';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

interface WhaleTransaction {
  address: string;
  tagKey: 'swing' | 'trend';
  tagColor: string;
  tagBg: string;
  asset: string;
  side: 'Long' | 'Short';
  marginType: 'Cross' | 'Isolated';
  positionValueUSD: string;
  positionValueAsset: string;
  entryPrice: string;
  winRate: string;
  timeMinutesAgo: number; // 0 => just now
}

const initialTransactions: WhaleTransaction[] = [
  {
    address: '0x481234567890abcdef1234567890abcdef1234af',
    tagKey: 'swing',
    tagColor: '#60a5fa',
    tagBg: '#3b82f633',
    asset: 'BTC',
    side: 'Short',
    marginType: 'Cross',
    positionValueUSD: '$1,017,138.41',
    positionValueAsset: '-11.62816 BTC',
    entryPrice: '$87502.6',
    winRate: '68%',
    timeMinutesAgo: 0,
  },
  {
    address: '0x7e1234567890abcdef1234567890abcdef1234fd',
    tagKey: 'trend',
    tagColor: '#c084fc',
    tagBg: '#a855f733',
    asset: 'BTC',
    side: 'Long',
    marginType: 'Cross',
    positionValueUSD: '$4,473,877.57',
    positionValueAsset: '52.06421 BTC',
    entryPrice: '$86148.8',
    winRate: '72%',
    timeMinutesAgo: 1,
  }
];

export const RealtimeWhalesTable = () => {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [transactions, setTransactions] = useState<WhaleTransaction[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { success } = useToast();

  const formatRelativeMinutes = (mins: number) => {
    if (mins <= 0) return t('whaleTracking.time.justNow');
    return t('whaleTracking.time.minutesAgo', { count: mins });
  };

  const fetchNewData = useCallback(async () => {
    setLoading(true);
    // Realtime mock delay: 200-400ms
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate prepending a new random transaction
    const assets = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];
    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
    const side = Math.random() > 0.5 ? 'Long' : 'Short'
    const tagKey = Math.random() > 0.5 ? 'swing' : 'trend'

    const tagStyle = tagKey === 'swing'
      ? { tagColor: '#60a5fa', tagBg: '#3b82f633' }
      : { tagColor: '#c084fc', tagBg: '#a855f733' }

    const basePriceByAsset: Record<string, number> = {
      BTC: 87_000,
      ETH: 3_200,
      SOL: 120,
      XRP: 2.3,
      DOGE: 0.12,
    }

    const entryPrice = (basePriceByAsset[randomAsset] ?? 100) * (0.95 + Math.random() * 0.1)
    const notionalUsd = (1_000_000 + Math.random() * 5_000_000)
    const quantity = notionalUsd / entryPrice
    const qtyAbs = randomAsset === 'BTC' ? 5 : randomAsset === 'ETH' ? 4 : randomAsset === 'SOL' ? 2 : 0
    const qtyFixed = Math.max(2, Math.min(6, qtyAbs))
    const qtyText = quantity.toFixed(qtyFixed)
    const signedQty = side === 'Short' ? `-${qtyText}` : qtyText
    const usdMillions = (notionalUsd / 1e6).toFixed(2)

    const newTx: WhaleTransaction = {
      address: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`,
      tagKey,
      tagColor: tagStyle.tagColor,
      tagBg: tagStyle.tagBg,
      asset: randomAsset,
      side,
      marginType: Math.random() > 0.5 ? 'Cross' : 'Isolated',
      positionValueUSD: `$${usdMillions}M`,
      positionValueAsset: `${signedQty} ${randomAsset}`,
      entryPrice: `$${entryPrice.toFixed(1)}`,
      winRate: `${Math.round(50 + Math.random() * 45)}%`,
      timeMinutesAgo: 0,
    };

    setTransactions(prev => [newTx, ...prev.slice(0, 14)]);
    setLoading(false);
  }, []);

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
              {transactions.map((tx, idx) => (
                <tr key={idx} className="hover:bg-[#1f2937]/50 transition-colors group cursor-pointer animate-in slide-in-from-left-2 duration-300" onClick={() => handleShowStats(tx.address)}>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/whale-tracking/profile/?address=${tx.address}`}
                          className="text-white text-body font-medium hover:underline decoration-primary decoration-2 underline-offset-4 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tx.address}
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
                    {formatRelativeMinutes(tx.timeMinutesAgo)}
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
