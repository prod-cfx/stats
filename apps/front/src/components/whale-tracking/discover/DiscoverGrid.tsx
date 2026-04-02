'use client';

import type {WhaleDiscoverResponse} from '@/lib/api';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/ui/loading';
import { useAsync } from '@/hooks/use-async';
import { fetchWhaleTrackingDiscover  } from '@/lib/api';
import { TraderCard } from './TraderCard';

const WhaleTradingStatsModal = dynamic(
  () => import('../WhaleTradingStatsModal').then(mod => mod.WhaleTradingStatsModal),
  { ssr: false, loading: () => null },
)

export const DiscoverGrid = () => {
  const { t } = useTranslation();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState<'winRate' | 'totalValue' | 'realizedPnl' | null>('winRate');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>('desc');

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  const {
    data,
    loading,
    error,
    execute: reload,
  } = useAsync<WhaleDiscoverResponse>(fetchWhaleTrackingDiscover, {
    immediate: true,
  });

  const sortedDetails = useMemo(() => {
    if (!data?.details) return [];
    if (!sortField || !sortOrder) return data.details;
    return [...data.details].sort((a, b) => {
      let valA: number
      let valB: number
      if (sortField === 'winRate') {
        valA = a.winRatePct;
        valB = b.winRatePct;
      } else if (sortField === 'totalValue') {
        valA = a.totalValueUsd;
        valB = b.totalValueUsd;
      } else if (sortField === 'realizedPnl') {
        valA = a.pnlUsd;
        valB = b.pnlUsd;
      } else {
        return 0;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [data, sortField, sortOrder]);

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
      return <ArrowUpDown className="w-3 h-3 text-[color:var(--cf-muted)] opacity-30 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'desc' ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="space-y-12">
      {/* Recommended Section */}
      <LoadingState isLoading={loading} error={!!error} onRetry={reload}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data?.recommended.map((trader, index) => (
            <TraderCard 
              key={`rec-${index}`} 
              {...trader} 
              onShowStats={handleShowStats}
            />
          ))}
        </div>
      </LoadingState>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center justify-between border-y border-[color:var(--cf-border)] py-6">
        <div className="flex items-center gap-4">
          <span className="text-[color:var(--cf-muted)] text-sm font-medium">{t('whaleTracking.discover.sortBy')}:</span>
          {([
            { id: 'winRate', label: t('whaleTracking.discover.sortFields.winRate') },
            { id: 'totalValue', label: t('whaleTracking.discover.sortFields.totalValue') },
            { id: 'realizedPnl', label: t('whaleTracking.discover.sortFields.realizedPnl') },
          ] as const).map((field) => (
            <button 
              key={field.id}
              type="button"
              onClick={() => {
                handleSort(field.id as Exclude<typeof sortField, null>);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors group ${
                sortField === field.id ? 'text-[color:var(--cf-text-strong)] bg-[color:var(--cf-surface-2)]' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
              }`}
            >
              <span className="uppercase">{field.label}</span>
              {renderSortIcon(field.id as Exclude<typeof sortField, null>)}
            </button>
          ))}
        </div>
      </div>

      {/* Detail Grid Section */}
      <LoadingState
        isLoading={loading}
        error={!!error}
        onRetry={reload}
        isEmpty={!loading && !error && sortedDetails.length === 0}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
          {sortedDetails.map((trader, index) => (
            <TraderCard 
              key={`det-${index}`} 
              {...trader} 
              onShowStats={handleShowStats}
            />
          ))}
        </div>
      </LoadingState>

      {/* Trading Stats Modal */}
      <WhaleTradingStatsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  );
};
