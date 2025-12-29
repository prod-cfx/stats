'use client';

import React, { useState } from 'react';
import { TraderCard, TraderCardProps } from './TraderCard';
import { ChevronDown } from 'lucide-react';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

export const DiscoverGrid = () => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };
  const recommendedTraders: TraderCardProps[] = [
    {
      variant: 'recommended',
      address: '0xb317...83ae',
      tag: '$10B HYPERUNIT WHALE',
      totalValue: '$176,973,494.50',
      pnl: '+$98,394,887.05',
      trades: 5,
      winRate: '80%',
      avatarColor: '#3b82f6',
    },
    {
      variant: 'recommended',
      address: '0xe0C8...78C1',
      tag: 'DeFi Yield Farmer',
      totalValue: '$525.51',
      pnl: '-$619,716.06',
      trades: 686,
      winRate: '23.18%',
      avatarColor: '#a855f7',
    },
    {
      variant: 'recommended',
      address: '0x35d1...aCb1',
      tag: 'Early BTC Adopter',
      totalValue: '$18,308,361.86',
      pnl: '+$1,826,272.13',
      trades: 16,
      winRate: '62.50%',
      avatarColor: '#14b8a6',
    },
  ];

  const aiTagsSet1 = [
    { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
    { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
    { label: '聪明交易者', color: '#fde047', bgColor: '#713f1233' },
  ];

  const aiTagsSet2 = [
    { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
    { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
    { label: '推特KOL', color: '#fde047', bgColor: '#713f1233' },
  ];

  const aiTagsSet3 = [
    { label: '多头战神', color: '#93c5fd', bgColor: '#1e3a8a33' },
    { label: '波段之王', color: '#d8b4fe', bgColor: '#581c8733' },
    { label: '金库管家', color: '#fde047', bgColor: '#713f1233' },
  ];

  const detailTraders: TraderCardProps[] = [
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#3b82f6',
      aiTags: aiTagsSet1
    },
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#a855f7',
      aiTags: aiTagsSet2
    },
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#14b8a6',
      aiTags: aiTagsSet3
    },
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#3b82f6',
      aiTags: aiTagsSet1
    },
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#a855f7',
      aiTags: aiTagsSet2
    },
    {
      variant: 'detail',
      address: '0x020c...5872',
      handle: '@machibigbrother',
      totalValue: '$1,198,579.41',
      pnl: '-$1,903,338.23',
      pnlLabel: '已实现盈亏(1月)',
      positions: 1,
      winRate: '33.33%',
      winRateLabel: '胜率(1月)',
      avatarColor: '#14b8a6',
      aiTags: aiTagsSet3
    }
  ];

  return (
    <div className="space-y-12">
      {/* Recommended Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recommendedTraders.map((trader, index) => (
          <TraderCard 
            key={`rec-${index}`} 
            {...trader} 
            onShowStats={handleShowStats}
          />
        ))}
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-4 py-6">
        {['胜率', '账户总价值', '已实现盈亏'].map((filter) => (
          <button 
            key={filter}
            className="px-6 py-2.5 bg-[#161b22] border border-[#30363d] rounded-xl text-[#888888] text-label font-bold flex items-center gap-3 hover:border-[#3b82f6]/50 transition-colors"
          >
            {filter}
            <div className="w-4 h-4 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3.5H10M4 6H8M5.5 8.5H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
        {detailTraders.map((trader, index) => (
          <TraderCard 
            key={`det-${index}`} 
            {...trader} 
            onShowStats={handleShowStats}
          />
        ))}
      </div>

      {/* Trading Stats Modal */}
      <WhaleTradingStatsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  );
};
