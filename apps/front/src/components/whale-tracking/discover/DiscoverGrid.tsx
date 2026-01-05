'use client';

import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/ui/loading';
import { useMockData } from '@/hooks/use-mock-data';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';
import { TraderCard } from './TraderCard';

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

  const tradersFetcher = async () => {
    // This would be replaced with real mock data generation or fetching
    return {
      recommended: [
        {
          variant: 'recommended' as const,
          address: '0xb31754025d57d727218ef86b97828135899983ae',
          tag: '$10B HYPERUNIT WHALE',
          totalValueUsd: 176_973_494.50,
          pnlUsd: 98_394_887.05,
          trades: 5,
          winRatePct: 80,
          avatarColor: '#3b82f6',
        },
        {
          variant: 'recommended' as const,
          address: '0xe0C8701234567890abcdef1234567890abcdef78C1',
          tag: 'DeFi Yield Farmer',
          totalValueUsd: 525.51,
          pnlUsd: -619_716.06,
          trades: 686,
          winRatePct: 23.18,
          avatarColor: '#a855f7',
        },
        {
          variant: 'recommended' as const,
          address: '0x35d1701234567890abcdef1234567890abcdaCb1',
          tag: 'Early BTC Adopter',
          totalValueUsd: 18_308_361.86,
          pnlUsd: 1_826_272.13,
          trades: 16,
          winRatePct: 62.5,
          avatarColor: '#14b8a6',
        },
      ],
      details: [
        {
          variant: 'detail' as const,
          address: '0x020c701234567890abcdef1234567890abcdef5872',
          handle: '@machibigbrother',
          totalValueUsd: 1_198_579.41,
          pnlUsd: -1_903_338.23,
          pnlLabelKey: 'realizedPnl1m',
          positions: 1,
          winRatePct: 33.33,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#3b82f6',
          aiTags: [
            { key: 'bullWarGod', color: '#93c5fd', bgColor: '#1e3a8a33', descriptionKey: 'bullWarGod' },
            { key: 'swingKing', color: '#d8b4fe', bgColor: '#581c8733', descriptionKey: 'swingKing' },
            { key: 'smartTrader', color: '#fde047', bgColor: '#713f1233', descriptionKey: 'smartTrader' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x6bb31754025d57d727218ef86b97828135899983ae',
          handle: '@whale_alpha',
          totalValueUsd: 2_500_000.00,
          pnlUsd: 1_200_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 3,
          winRatePct: 75.00,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#a855f7',
          aiTags: [
            { key: 'smartTrader', color: '#fde047', bgColor: '#713f1233' },
            { key: 'treasuryKeeper', color: '#fde047', bgColor: '#713f1233', descriptionKey: 'treasuryKeeper' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x701234567890abcdef1234567890abcdef12345678',
          handle: '@yield_master',
          totalValueUsd: 8_450_000.00,
          pnlUsd: 450_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 12,
          winRatePct: 58.33,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#14b8a6',
          aiTags: [
            { key: 'twitterKol', color: '#fde047', bgColor: '#713f1233', descriptionKey: 'twitterKol' },
            { key: 'bullWarGod', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0xdf1234567890abcdef1234567890abcdef12345678',
          handle: '@alpha_hunter',
          totalValueUsd: 15_000_000.00,
          pnlUsd: 5_000_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 5,
          winRatePct: 90.00,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#3b82f6',
          aiTags: [
            { key: 'swingKing', color: '#d8b4fe', bgColor: '#581c8733' },
            { key: 'bullWarGod', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0xa7b31234567890abcdef1234567890abcdef0a7b3',
          handle: '@swing_sniper',
          totalValueUsd: 6_220_900.12,
          pnlUsd: 872_301.11,
          pnlLabelKey: 'realizedPnl1m',
          positions: 7,
          winRatePct: 66.67,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#f97316',
          aiTags: [
            { key: 'swingKing', color: '#d8b4fe', bgColor: '#581c8733' },
            { key: 'smartTrader', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x3c1a1234567890abcdef1234567890abcdef3c1a',
          handle: '@macro_whale',
          totalValueUsd: 42_350_000.00,
          pnlUsd: 3_150_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 2,
          winRatePct: 83.33,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#22c55e',
          aiTags: [
            { key: 'treasuryKeeper', color: '#fde047', bgColor: '#713f1233' },
            { key: 'bullWarGod', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x9fef1234567890abcdef1234567890abcdef9fef',
          handle: '@contrarian',
          totalValueUsd: 3_950_120.54,
          pnlUsd: -210_334.22,
          pnlLabelKey: 'realizedPnl1m',
          positions: 9,
          winRatePct: 47.62,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#ef4444',
          aiTags: [
            { key: 'smartTrader', color: '#fde047', bgColor: '#713f1233' },
            { key: 'twitterKol', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x51e21234567890abcdef1234567890abcdef51e2',
          handle: '@range_rider',
          totalValueUsd: 11_420_000.00,
          pnlUsd: 920_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 4,
          winRatePct: 71.43,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#06b6d4',
          aiTags: [
            { key: 'swingKing', color: '#d8b4fe', bgColor: '#581c8733' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x7aa91234567890abcdef1234567890abcdef7aa9',
          handle: '@trend_follower',
          totalValueUsd: 9_880_410.77,
          pnlUsd: 1_040_110.05,
          pnlLabelKey: 'realizedPnl1m',
          positions: 6,
          winRatePct: 60.00,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#8b5cf6',
          aiTags: [
            { key: 'bullWarGod', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x2d0b1234567890abcdef1234567890abcdef2d0b',
          handle: '@low_risk',
          totalValueUsd: 1_820_000.00,
          pnlUsd: 58_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 1,
          winRatePct: 55.00,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#84cc16',
          aiTags: [
            { key: 'treasuryKeeper', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x8c0d1234567890abcdef1234567890abcdef8c0d',
          handle: '@altcoin_beta',
          totalValueUsd: 4_760_000.00,
          pnlUsd: 640_000.00,
          pnlLabelKey: 'realizedPnl1m',
          positions: 15,
          winRatePct: 52.00,
          winRateLabelKey: 'winRate1m',
          avatarColor: '#f59e0b',
          aiTags: [
            { key: 'twitterKol', color: '#fde047', bgColor: '#713f1233' },
            { key: 'swingKing', color: '#d8b4fe', bgColor: '#581c8733' },
          ]
        }
      ]
    };
  };

  const { data, loading, error, reload } = useMockData(tradersFetcher, []);

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
      return <ArrowUpDown className="w-3 h-3 text-[#8b949e] opacity-30 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'desc' ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="space-y-12">
      {/* Recommended Section */}
      <LoadingState isLoading={loading} error={error} onRetry={reload}>
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
      <div className="flex flex-wrap items-center justify-between border-y border-[#30363d] py-6">
        <div className="flex items-center gap-4">
          <span className="text-[#8b949e] text-sm font-medium">{t('whaleTracking.discover.sortBy')}:</span>
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
                sortField === field.id ? 'text-white bg-white/5' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <span className="uppercase">{field.label}</span>
              {renderSortIcon(field.id as Exclude<typeof sortField, null>)}
            </button>
          ))}
        </div>
      </div>

      {/* Detail Grid Section */}
      <LoadingState isLoading={loading} error={error} onRetry={reload} isEmpty={!loading && sortedDetails.length === 0}>
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
