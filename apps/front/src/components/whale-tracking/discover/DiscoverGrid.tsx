'use client';

import { ArrowDownAZ, ArrowUpAZ, ChevronDown } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { LoadingState } from '@/components/ui/loading';
import { useMockData } from '@/hooks/use-mock-data';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';
import { TraderCard } from './TraderCard';

export const DiscoverGrid = () => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState('胜率');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
        }
      ]
    };
  };

  const { data, loading, error, reload } = useMockData(tradersFetcher, [sortField]);

  const sortedDetails = useMemo(() => {
    if (!data?.details) return [];
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
                if (sortField === field) {
                  setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortField(field);
                  setSortOrder('desc');
                }
                reload();
              }}
              className={`px-6 py-2 bg-[#161b22] border rounded-xl text-label font-bold flex items-center gap-3 transition-all ${
                sortField === field 
                  ? 'border-primary text-primary bg-primary/5' 
                  : 'border-[#30363d] text-[#c9d1d9] hover:border-[#8b949e]'
              }`}
            >
              {field}
              <div className="w-4 h-4 flex items-center justify-center">
                {sortField === field ? (
                  sortOrder === 'desc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-30" />
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="text-[#8b949e] text-sm">
          展示 <span className="text-white font-bold">{sortedDetails.length}</span> 位顶级交易员
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
