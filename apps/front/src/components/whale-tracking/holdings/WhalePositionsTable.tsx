'use client';

import { Copy, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

interface WhalePosition {
  address: string;
  tags: { label: string; color: string; bg: string }[];
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
  createdTime: string;
  remark: string;
}

const mockPositions: WhalePosition[] = [
  {
    address: '0xb51754025d57d727218ef86b97828135899983ae',
    tags: [
      { label: '巨鲸', color: '#c084fc', bg: '#a855f733' },
      { label: '高频', color: '#60a5fa', bg: '#3b82f633' },
    ],
    asset: 'ETH',
    side: 'Short',
    leverage: '20x',
    marginType: 'Isolated',
    positionValueUSD: '$1,178,000',
    positionValueAsset: '-400 ETH',
    pnlUSD: '$-1,150.80',
    pnlPercent: '-1.95%',
    margin: '$58,900.00',
    entryPrice: '$2942.12',
    liqPrice: '$4233.52',
    winRate: '--',
    createdTime: '15 分钟前',
    remark: '',
  },
  {
    address: '0x701234567890abcdef1234567890abcdef12345678',
    tags: [
      { label: '稳健', color: '#facc15', bg: '#eab30833' },
    ],
    asset: 'BTC',
    side: 'Long',
    leverage: '25x',
    marginType: 'Isolated',
    positionValueUSD: '$1,059,876',
    positionValueAsset: '360 ETH',
    pnlUSD: '$+9,598.28',
    pnlPercent: '+22.64%',
    margin: '$42,395.04',
    entryPrice: '$2917.43',
    liqPrice: '$2869.46',
    winRate: '82%',
    createdTime: '1 小时前',
    remark: 'James WynnReal',
  },
  {
    address: '0x6bb31754025d57d727218ef86b97828135899983ae',
    tags: [
      { label: '巨鲸', color: '#c084fc', bg: '#a855f733' },
    ],
    asset: 'SOL',
    side: 'Long',
    leverage: '25x',
    marginType: 'Isolated',
    positionValueUSD: '$1,661,700.08',
    positionValueAsset: '564.42 ETH',
    pnlUSD: '$+10,725.08',
    pnlPercent: '+16.14%',
    margin: '$66,468.00',
    entryPrice: '$2925.09',
    liqPrice: '$2880.70',
    winRate: '71%',
    createdTime: '1 小时前',
    remark: '-',
  }
];

export const WhalePositionsTable = () => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState('所有币种');
  const [sideFilter, setSideFilter] = useState('所有方向');
  const [sortField, setSortFilter] = useState('持仓价值');

  // Use standardized mock hook
  const { data: positions, loading, error, reload } = useMockData<WhalePosition[]>(
    async () => {
      // Simulate filtering
      return mockPositions.filter(p => {
        if (assetFilter !== '所有币种' && p.asset !== assetFilter) return false;
        if (sideFilter !== '所有方向' && p.side !== sideFilter) return false;
        return true;
      });
    },
    [assetFilter, sideFilter]
  );

  const sortedPositions = useMemo(() => {
    if (!positions) return [];
    return [...positions].sort((a, b) => {
      if (sortField === '持仓价值') {
        return Number.parseFloat(b.positionValueUSD.replace(/[$,]/g, '')) - Number.parseFloat(a.positionValueUSD.replace(/[$,]/g, ''));
      }
      if (sortField === '盈亏') {
        return Number.parseFloat(b.pnlUSD.replace(/[$,]/g, '')) - Number.parseFloat(a.pnlUSD.replace(/[$,]/g, ''));
      }
      return 0;
    });
  }, [positions, sortField]);

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <PageTitle>鲸鱼持仓</PageTitle>
          <BodyText>追踪大额持仓者的最新动态</BodyText>
        </div>
        <div className="flex items-center gap-3">
          <FilterButton 
            value={assetFilter} 
            options={['所有币种', 'BTC', 'ETH', 'SOL']} 
            onChange={setAssetFilter} 
          />
          <FilterButton 
            value={sideFilter} 
            options={['所有方向', 'Long', 'Short']} 
            onChange={setSideFilter} 
          />
          <FilterButton 
            value={sortField} 
            options={['持仓价值', '盈亏']} 
            onChange={setSortFilter} 
          />
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-[400px] relative">
        <LoadingState 
          isLoading={loading} 
          error={error} 
          isEmpty={!loading && sortedPositions.length === 0}
          onRetry={reload}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[#8b949e] border-b border-[#30363d]">
                  <th className="px-6 py-4 text-left">地址</th>
                  <th className="px-6 py-4 text-left">币种</th>
                  <th className="px-6 py-4 text-left">持仓价值</th>
                  <th className="px-6 py-4 text-left">未实现盈亏</th>
                  <th className="px-6 py-4 text-left">保证金</th>
                  <th className="px-6 py-4 text-left">开盘价</th>
                  <th className="px-6 py-4 text-left">清算价</th>
                  <th className="px-6 py-4 text-left">胜率</th>
                  <th className="px-6 py-4 text-left">创建时间</th>
                  <th className="px-6 py-4 text-left">备注</th>
                  <th className="px-6 py-4 text-center w-16">操作</th>
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
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`px-1.5 py-0.5 rounded text-caption font-bold ${pos.side === 'Long' ? 'bg-[#22c55e33] text-[#4ade80]' : 'bg-[#ef444433] text-[#f87171]'}`}>
                          {pos.side === 'Long' ? '多' : '空'}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white text-body font-bold">{pos.asset}</span>
                          <span className="text-[#8b949e] text-caption">{pos.marginType} {pos.leverage}</span>
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
                      {pos.createdTime}
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
