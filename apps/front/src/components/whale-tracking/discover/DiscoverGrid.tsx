'use client';

import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { LoadingState } from '@/components/ui/loading';
import { useMockData } from '@/hooks/use-mock-data';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';
import { TraderCard } from './TraderCard';

export const DiscoverGrid = () => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState<'胜率' | '账户总价值' | '已实现盈亏' | null>('胜率');
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
          totalValue: '$176,973,494.50',
          pnl: '+$98,394,887.05',
          trades: 5,
          winRate: '80%',
          avatarColor: '#3b82f6',
        },
        {
          variant: 'recommended' as const,
          address: '0xe0C8701234567890abcdef1234567890abcdef78C1',
          tag: 'DeFi Yield Farmer',
          totalValue: '$525.51',
          pnl: '-$619,716.06',
          trades: 686,
          winRate: '23.18%',
          avatarColor: '#a855f7',
        },
        {
          variant: 'recommended' as const,
          address: '0x35d1701234567890abcdef1234567890abcdaCb1',
          tag: 'Early BTC Adopter',
          totalValue: '$18,308,361.86',
          pnl: '+$1,826,272.13',
          trades: 16,
          winRate: '62.50%',
          avatarColor: '#14b8a6',
        },
      ],
      details: [
        {
          variant: 'detail' as const,
          address: '0x020c701234567890abcdef1234567890abcdef5872',
          handle: '@machibigbrother',
          totalValue: '$1,198,579.41',
          pnl: '-$1,903,338.23',
          pnlLabel: '已实现盈亏(1月)',
          positions: 1,
          winRate: '33.33%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#3b82f6',
          aiTags: [
            { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33', description: '该地址在过去30天内主要持有且盈利的多头头寸' },
            { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733', description: '交易频率适中，主要捕捉短中期价格波动' },
            { label: '聪明交易者', color: '#fde047', bgColor: '#713f1233', description: '历史成交记录显示其卖出点位极佳' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x6bb31754025d57d727218ef86b97828135899983ae',
          handle: '@whale_alpha',
          totalValue: '$2,500,000.00',
          pnl: '+$1,200,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 3,
          winRate: '75.00%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#a855f7',
          aiTags: [
            { label: '聪明交易者', color: '#fde047', bgColor: '#713f1233' },
            { label: '金库管家', color: '#fde047', bgColor: '#713f1233', description: '持有大量稳定币及蓝筹资产，风险偏好极低' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x701234567890abcdef1234567890abcdef12345678',
          handle: '@yield_master',
          totalValue: '$8,450,000.00',
          pnl: '+$450,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 12,
          winRate: '58.33%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#14b8a6',
          aiTags: [
            { label: '推特KOL', color: '#fde047', bgColor: '#713f1233', description: '链上行为与推特公开言论高度一致，具备市场影响力' },
            { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0xdf1234567890abcdef1234567890abcdef12345678',
          handle: '@alpha_hunter',
          totalValue: '$15,000,000.00',
          pnl: '+$5,000,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 5,
          winRate: '90.00%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#3b82f6',
          aiTags: [
            { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
            { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0xa7b31234567890abcdef1234567890abcdef0a7b3',
          handle: '@swing_sniper',
          totalValue: '$6,220,900.12',
          pnl: '+$872,301.11',
          pnlLabel: '已实现盈亏(1月)',
          positions: 7,
          winRate: '66.67%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#f97316',
          aiTags: [
            { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
            { label: '聪明交易者', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x3c1a1234567890abcdef1234567890abcdef3c1a',
          handle: '@macro_whale',
          totalValue: '$42,350,000.00',
          pnl: '+$3,150,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 2,
          winRate: '83.33%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#22c55e',
          aiTags: [
            { label: '金库管家', color: '#fde047', bgColor: '#713f1233' },
            { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x9fef1234567890abcdef1234567890abcdef9fef',
          handle: '@contrarian',
          totalValue: '$3,950,120.54',
          pnl: '-$210,334.22',
          pnlLabel: '已实现盈亏(1月)',
          positions: 9,
          winRate: '47.62%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#ef4444',
          aiTags: [
            { label: '聪明交易者', color: '#fde047', bgColor: '#713f1233' },
            { label: '推特KOL', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x51e21234567890abcdef1234567890abcdef51e2',
          handle: '@range_rider',
          totalValue: '$11,420,000.00',
          pnl: '+$920,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 4,
          winRate: '71.43%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#06b6d4',
          aiTags: [
            { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x7aa91234567890abcdef1234567890abcdef7aa9',
          handle: '@trend_follower',
          totalValue: '$9,880,410.77',
          pnl: '+$1,040,110.05',
          pnlLabel: '已实现盈亏(1月)',
          positions: 6,
          winRate: '60.00%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#8b5cf6',
          aiTags: [
            { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x2d0b1234567890abcdef1234567890abcdef2d0b',
          handle: '@low_risk',
          totalValue: '$1,820,000.00',
          pnl: '+$58,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 1,
          winRate: '55.00%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#84cc16',
          aiTags: [
            { label: '金库管家', color: '#fde047', bgColor: '#713f1233' },
          ]
        },
        {
          variant: 'detail' as const,
          address: '0x8c0d1234567890abcdef1234567890abcdef8c0d',
          handle: '@altcoin_beta',
          totalValue: '$4,760,000.00',
          pnl: '+$640,000.00',
          pnlLabel: '已实现盈亏(1月)',
          positions: 15,
          winRate: '52.00%',
          winRateLabel: '胜率(1月)',
          avatarColor: '#f59e0b',
          aiTags: [
            { label: '推特KOL', color: '#fde047', bgColor: '#713f1233' },
            { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
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
      let valA, valB;
      if (sortField === '胜率') {
        valA = Number.parseFloat(a.winRate);
        valB = Number.parseFloat(b.winRate);
      } else if (sortField === '账户总价值') {
        valA = Number.parseFloat(a.totalValue.replace(/[$,]/g, ''));
        valB = Number.parseFloat(b.totalValue.replace(/[$,]/g, ''));
      } else if (sortField === '已实现盈亏') {
        valA = Number.parseFloat(a.pnl.replace(/[$,]/g, ''));
        valB = Number.parseFloat(b.pnl.replace(/[$,]/g, ''));
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
          <span className="text-[#8b949e] text-sm font-medium">排序方式:</span>
          {['胜率', '账户总价值', '已实现盈亏'].map((field) => (
            <button 
              key={field}
              type="button"
              onClick={() => {
                handleSort(field as Exclude<typeof sortField, null>);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors group ${
                sortField === field ? 'text-white bg-white/5' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <span className="uppercase">{field}</span>
              {renderSortIcon(field as Exclude<typeof sortField, null>)}
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
