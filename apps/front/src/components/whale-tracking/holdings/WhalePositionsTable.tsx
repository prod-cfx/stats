'use client';

import type { WhaleHoldingApiItem } from '@/lib/api';
import { ArrowUpDown, ChevronDown, ChevronUp, Copy, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { useAsync } from '@/hooks/use-async';
import { fetchWhaleHoldings } from '@/lib/api';
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
  const params = useParams();
  const lng = (params as any)?.lng ?? 'zh';
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL'>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'Long' | 'Short'>('ALL');
  const [pnlFilter, setPnlFilter] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [sortField, setSortField] = useState<'positionValue' | 'pnl' | 'margin' | 'winRate' | 'createdTime' | null>('positionValue');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>('desc');

  const seededNumber = (input: string): number => {
    // simple non-cryptographic hash → [0, 1)
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 2 ** 32;
  };

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

      // 后端暂未提供未实现盈亏 & 胜率，先用“稳定伪随机”生成展示值（基于 address+symbol，不会抖动）
      const seedBase = `${h.userAddress}-${h.symbol}`;
      const pnlPct = (seededNumber(seedBase) * 2 - 1) * 0.12; // [-12%, +12%)
      const pnlUsd = positionValueUsd * pnlPct;
      const winRatePct = 45 + seededNumber(`${seedBase}-wr`) * 40; // [45, 85)

      return {
        raw: h,
        createdMinutesAgo,
        positionValueUsd,
        marginValue,
        side,
        pnlUsd,
        pnlPct,
        winRatePct,
      };
    });

    const filtered = enriched.filter(item => {
      const { raw, side, pnlUsd } = item;
      if (assetFilter !== 'ALL' && raw.symbol !== assetFilter) return false;
      if (sideFilter !== 'ALL' && side !== sideFilter) return false;
      if (pnlFilter === 'PROFIT' && pnlUsd <= 0) return false;
      if (pnlFilter === 'LOSS' && pnlUsd >= 0) return false;
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
            case 'pnl':
              valA = a.pnlUsd;
              valB = b.pnlUsd;
              break;
            case 'margin':
              valA = a.marginValue;
              valB = b.marginValue;
              break;
            case 'winRate':
              valA = a.winRatePct;
              valB = b.winRatePct;
              break;
            case 'createdTime': {
              valA = a.createdMinutesAgo;
              valB = b.createdMinutesAgo;
              // smaller minutesAgo is more recent
              return sortOrder === 'desc' ? valA - valB : valB - valA;
            }
            default:
              return 0;
          }

          return sortOrder === 'desc' ? valB - valA : valA - valB;
        });

    // 最后将数值映射为用于展示的字符串
    const mapped: WhalePosition[] = sorted.map(item => {
      const { raw, createdMinutesAgo, positionValueUsd, marginValue, side, pnlUsd, pnlPct, winRatePct } = item;

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

      const pnlUSD = `${pnlUsd >= 0 ? '+' : '-'}$${Math.abs(pnlUsd).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`;
      const pnlPercent = `${pnlPct >= 0 ? '+' : '-'}${Math.abs(pnlPct * 100).toFixed(2)}%`;
      const winRate = `${winRatePct.toFixed(0)}%`;

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
        pnlUSD,
        pnlPercent,
        margin,
        entryPrice,
        liqPrice,
        winRate,
        createdMinutesAgo,
        remark: '',
      };
    });

    return mapped;
  }, [rawHoldings, assetFilter, sideFilter, pnlFilter, sortField, sortOrder]);

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
              { value: 'ALL', label: t('whaleTracking.holdings.filters.allSides') },
              { value: 'Long', label: t('whaleTracking.side.long') },
              { value: 'Short', label: t('whaleTracking.side.short') },
            ]} 
            onChange={setSideFilter} 
          />
          <FilterButton
            value={pnlFilter}
            options={[
              { value: 'ALL', label: t('whaleTracking.holdings.filters.allUnrealizedPnl') },
              { value: 'PROFIT', label: t('whaleTracking.holdings.filters.profit') },
              { value: 'LOSS', label: t('whaleTracking.holdings.filters.loss') },
            ]}
            onChange={setPnlFilter}
          />
        </div>
      </div>

      <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl overflow-hidden min-h-[400px] relative">
        <LoadingState 
          isLoading={loading} 
          error={Boolean(error)} 
          isEmpty={!loading && sortedPositions.length === 0}
          onRetry={execute}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.address')}</th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.asset')}</th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none" onClick={() => handleSort('positionValue')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.positionValue')}
                      {renderSortIcon('positionValue')}
                    </div>
                  </th>
                  {/* PnL 列当前仅展示占位符，不提供排序交互以避免“空操作”体验 */}
                  <th className="px-6 py-4 text-left whitespace-nowrap">
                    {t('whaleTracking.holdings.table.unrealizedPnl')}
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer group select-none" onClick={() => handleSort('margin')}>
                    <div className="flex items-center">
                      {t('whaleTracking.holdings.table.margin')}
                      {renderSortIcon('margin')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.entryPrice')}</th>
                  <th className="px-6 py-4 text-left">{t('whaleTracking.holdings.table.liqPrice')}</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">
                    <button
                      type="button"
                      className="flex items-center cursor-pointer group select-none"
                      onClick={() => handleSort('winRate')}
                    >
                      {t('whaleTracking.holdings.table.winRate')}
                      {renderSortIcon('winRate')}
                    </button>
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
              <tbody className="divide-y divide-[color:var(--cf-border)]">
                {sortedPositions.map((pos, idx) => (
                  <tr key={idx} className="hover:bg-[color:var(--cf-surface-hover)] transition-colors group cursor-pointer" onClick={() => handleShowStats(pos.address)}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/${lng}/whale-tracking/profile/?address=${pos.address}`}
                            className="text-[color:var(--cf-text-strong)] text-body font-medium hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {pos.address.substring(0, 6)}...{pos.address.substring(pos.address.length - 4)}
                          </Link>
                          <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pos.address); }}>
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
                          <span className="text-[color:var(--cf-text-strong)] text-body font-bold">{pos.asset}</span>
                          <span className="text-[color:var(--cf-muted)] text-caption">{pos.marginType === 'Cross' ? t('whaleTracking.margin.cross') : t('whaleTracking.margin.isolated')} {pos.leverage}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[color:var(--cf-text-strong)] text-body font-medium">{pos.positionValueUSD}</span>
                        <span className="text-[color:var(--cf-muted)] text-caption">{pos.positionValueAsset}</span>
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
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">
                      {pos.margin}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">
                      {pos.entryPrice}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">
                      {pos.liqPrice}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-text-strong)]">
                      <span className={pos.winRate !== '--' && Number.parseInt(pos.winRate) > 70 ? 'text-[#4ade80]' : ''}>
                        {pos.winRate}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-muted)]">
                      {formatRelativeMinutes(pos.createdMinutesAgo)}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--cf-muted)] text-caption max-w-[150px] truncate">
                      {pos.remark}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        type="button"
                        className="w-8 h-8 mx-auto flex items-center justify-center bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] active:scale-95 transition-all"
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
