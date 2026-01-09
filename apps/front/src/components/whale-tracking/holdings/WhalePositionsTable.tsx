'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Copy, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { useAsync } from '@/hooks/use-async';
import { fetchWhaleHoldings } from '@/lib/api';
import type { WhaleHoldingApiItem } from '@/lib/api';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

interface WhalePosition {
  address: string;
  tags: { key: 'whale' | 'hft' | 'steady'; color: string; bg: string }[];
  asset: string;
  side: 'Long' | 'Short';
  leverage: string;
  marginType: 'Cross' | 'Isolated';
  positionValueUSD: string;
  positionValueAsset: string;
  pnlUSD: string;
  pnlPercent: string;
  margin: string;
  entryPrice: string;
  liqPrice: string;
  winRate: string;
  createdMinutesAgo: number; // 0 => just now
  remark: string;
}

export const WhalePositionsTable = () => {
  const { t } = useTranslation();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL'>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'Long' | 'Short'>('ALL');
  // 目前后端未返回 PnL 相关字段，暂不开放盈亏筛选，避免“空操作”体验
  // const [pnlFilter, setPnlFilter] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [sortField, setSortField] = useState<'positionValue' | 'pnl' | 'margin' | 'winRate' | 'createdTime' | null>('positionValue');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>('desc');

  const formatRelativeMinutes = (mins: number) => {
    if (mins <= 0) return t('whaleTracking.time.justNow');
    if (mins < 60) return t('whaleTracking.time.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    return t('whaleTracking.time.hoursAgo', { count: hours });
  };

  const { data: rawHoldings, loading, error, execute } = useAsync<WhaleHoldingApiItem[]>(
    async () => {
      return fetchWhaleHoldings({
        symbol: assetFilter !== 'ALL' ? assetFilter : undefined,
        // 仅保留名义价值较大的鲸鱼单子
        minPositionValueUsd: 1_000_000,
        timeRangeHours: 24,
        limit: 200,
      });
    },
    { immediate: true }
  );

  // 资产过滤变化时重新拉取（首屏请求由 useAsync 的 immediate=true 触发）
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    execute();
  }, [execute, assetFilter]);

  const sortedPositions = useMemo(() => {
    if (!rawHoldings) return [];

    const now = Date.now();

    // 先在数值层面做过滤和排序，最后再做格式化，避免 locale 相关的字符串互转问题
    const enriched = rawHoldings.map(h => {
      const createdAt = new Date(h.createTime).getTime();
      const createdMinutesAgo = Math.max(0, Math.floor((now - createdAt) / 60_000));

      const positionValueUsd = h.positionValueUsd;
      const marginValue = positionValueUsd / 10; // 简单估算，仅用于展示
      const side: 'Long' | 'Short' = h.side === 'LONG' ? 'Long' : 'Short';

      return {
        raw: h,
        createdMinutesAgo,
        positionValueUsd,
        marginValue,
        side,
      };
    });

    const filtered = enriched.filter(item => {
      const { raw, side } = item;
      if (assetFilter !== 'ALL' && raw.symbol !== assetFilter) return false;
      if (sideFilter !== 'ALL' && side !== sideFilter) return false;

      // 目前后端未提供 PnL 数据，选择 PnL 过滤时保持原始集合，避免错误解析
      return true;
    });

    const sorted = (!sortField || !sortOrder)
      ? filtered
      : [...filtered].sort((a, b) => {
          let valA: number;
          let valB: number;

          switch (sortField) {
            case 'positionValue':
              valA = a.positionValueUsd;
              valB = b.positionValueUsd;
              break;
            case 'margin':
              valA = a.marginValue;
              valB = b.marginValue;
              break;
            case 'createdTime': {
              valA = a.createdMinutesAgo;
              valB = b.createdMinutesAgo;
              // smaller minutesAgo is more recent
              return sortOrder === 'desc' ? valA - valB : valB - valA;
            }
            case 'pnl':
            case 'winRate':
            default:
              return 0;
          }

          return sortOrder === 'desc' ? valB - valA : valA - valB;
        });

    // 最后将数值映射为用于展示的字符串
    const mapped: WhalePosition[] = sorted.map(item => {
      const { raw, createdMinutesAgo, positionValueUsd, marginValue, side } = item;

      const positionValueUSD = `$${positionValueUsd.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;

      const positionValueAsset = `${raw.positionSize.toFixed(2)} ${raw.symbol}`;

      const margin = `$${marginValue.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;

      const entryPrice = `$${raw.entryPrice.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;

      const liqPrice = `$${raw.liquidationPrice.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;

      const tags: WhalePosition['tags'] = [
        { key: 'whale', color: '#c084fc', bg: '#a855f733' },
      ];

      return {
        address: raw.userAddress,
        tags,
        asset: raw.symbol,
        side,
        leverage: '—',
        marginType: 'Cross',
        positionValueUSD,
        positionValueAsset,
        pnlUSD: '--',
        pnlPercent: '--',
        margin,
        entryPrice,
        liqPrice,
        winRate: '--',
        createdMinutesAgo,
        remark: '',
      };
    });

    return mapped;
  }, [rawHoldings, assetFilter, sideFilter, sortField, sortOrder]);

  const handleSort = (field: Exclude<typeof sortField, null>) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortField(null);
        setSortOrder(null);
      } else {
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: Exclude<typeof sortField, null>) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-[#8b949e] opacity-30 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />;
    }
    return sortOrder === 'desc' ? <ChevronDown className="w-4 h-4 text-primary ml-1 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 text-primary ml-1 flex-shrink-0" />;
  };

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <PageTitle>{t('whaleTracking.holdings.title')}</PageTitle>
          <BodyText>{t('whaleTracking.holdings.subtitle')}</BodyText>
          <div className="flex items-center gap-4">
            {/* Removed standalone sort buttons */}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FilterButton 
            value={assetFilter} 
            options={[
              { value: 'ALL', label: t('common.all') },
              { value: 'BTC', label: 'BTC' },
              { value: 'ETH', label: 'ETH' },
              { value: 'SOL', label: 'SOL' },
            ]} 
            onChange={setAssetFilter} 
          />
          <FilterButton 
            value={sideFilter} 
            options={[
              { value: 'ALL', label: t('common.all') },
              { value: 'Long', label: t('whaleTracking.side.long') },
              { value: 'Short', label: t('whaleTracking.side.short') },
            ]} 
            onChange={setSideFilter} 
          />
          {/* PnL 筛选暂未开放，待后端提供盈亏数据后再启用 */}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative">
        <LoadingState 
          isLoading={loading} 
          error={Boolean(error)} 
          isEmpty={!loading && sortedPositions.length === 0}
          onRetry={execute}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[#8b949e] border-b border-[#30363d]">
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.address')}</th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.asset')}</th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none" onClick={() => handleSort('positionValue')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.positionValue')}
                      {renderSortIcon('positionValue')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none whitespace-nowrap" onClick={() => handleSort('pnl')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.unrealizedPnl')}
                      {renderSortIcon('pnl')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none" onClick={() => handleSort('margin')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.margin')}
                      {renderSortIcon('margin')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.entryPrice')}</th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.liqPrice')}</th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none whitespace-nowrap" onClick={() => handleSort('winRate')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.winRate')}
                      {renderSortIcon('winRate')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none whitespace-nowrap" onClick={() => handleSort('createdTime')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.createdTime')}
                      {renderSortIcon('createdTime')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.remark')}</th>
                  <th className="px-6 py-4 text-center w-16">{t('whaleTracking.holdings.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {sortedPositions.map((pos, idx) => (
                  <tr key={idx} className="hover:bg-[#1f2937] transition-colors group cursor-pointer" onClick={() => handleShowStats(pos.address)}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/whale-tracking/profile/?address=${pos.address}`}
                            className="text-white text-body font-medium hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pos.address.substring(0, 6)}...{pos.address.substring(pos.address.length - 4)}
                          </Link>
                          <button type="button" className="text-[#8b949e] hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pos.address); }}>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {pos.tags.map((tag, tIdx) => (
                            <span 
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded text-caption font-medium"
                              style={{ color: tag.color, backgroundColor: tag.bg }}
                            >
                              {t(`whaleTracking.tags.${tag.key}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`px-1.5 py-0.5 rounded text-caption font-bold ${pos.side === 'Long' ? 'bg-[#22c55e33] text-[#4ade80]' : 'bg-[#ef444433] text-[#f87171]'}`}>
                          {pos.side === 'Long' ? t('whaleTracking.side.longAbbr') : t('whaleTracking.side.shortAbbr')}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white text-body font-bold">{pos.asset}</span>
                          <span className="text-[#8b949e] text-caption">{pos.marginType === 'Cross' ? t('whaleTracking.margin.cross') : t('whaleTracking.margin.isolated')} {pos.leverage}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white text-body font-medium">{pos.positionValueUSD}</span>
                        <span className="text-[#8b949e] text-caption">{pos.positionValueAsset}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-body font-medium ${pos.pnlUSD.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                          {pos.pnlUSD}
                        </span>
                        <span className={`text-caption ${pos.pnlPercent.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                          {pos.pnlPercent}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white">
                      {pos.margin}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {pos.entryPrice}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {pos.liqPrice}
                    </td>
                    <td className="px-6 py-4 text-white">
                      <span className={pos.winRate !== '--' && Number.parseInt(pos.winRate) > 70 ? 'text-[#4ade80]' : ''}>
                        {pos.winRate}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#8b949e]">
                      {formatRelativeMinutes(pos.createdMinutesAgo)}
                    </td>
                    <td className="px-6 py-4 text-[#8b949e] text-caption max-w-[150px] truncate">
                      {pos.remark}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        type="button"
                        className="w-8 h-8 mx-auto flex items-center justify-center bg-[#0d1117] border border-[#30363d] rounded-lg text-[#8b949e] hover:text-white active:scale-95 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowStats(pos.address);
                        }}
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>

      <WhaleTradingStatsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  );
};
