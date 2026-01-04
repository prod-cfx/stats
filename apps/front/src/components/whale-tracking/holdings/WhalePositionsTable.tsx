'use client';

import { ArrowUpDown, ChevronDown, ChevronUp, Copy, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterButton } from '@/components/ui/FilterButton';
import { LoadingState } from '@/components/ui/loading';
import { BodyText, PageTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';
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

const mockPositions: WhalePosition[] = [
  {
    address: '0xb51754025d57d727218ef86b97828135899983ae',
    tags: [
      { key: 'whale', color: '#c084fc', bg: '#a855f733' },
      { key: 'hft', color: '#60a5fa', bg: '#3b82f633' },
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
    createdMinutesAgo: 15,
    remark: '',
  },
  {
    address: '0x701234567890abcdef1234567890abcdef12345678',
    tags: [
      { key: 'steady', color: '#facc15', bg: '#eab30833' },
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
    createdMinutesAgo: 60,
    remark: 'James WynnReal',
  },
  {
    address: '0x6bb31754025d57d727218ef86b97828135899983ae',
    tags: [
      { key: 'whale', color: '#c084fc', bg: '#a855f733' },
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
    createdMinutesAgo: 60,
    remark: '-',
  }
];

export const WhalePositionsTable = () => {
  const { t } = useTranslation();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL'>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'Long' | 'Short'>('ALL');
  const [pnlFilter, setPnlFilter] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [sortField, setSortField] = useState<'positionValue' | 'pnl' | 'margin' | 'winRate' | 'createdTime' | null>('positionValue');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>('desc');

  const formatRelativeMinutes = (mins: number) => {
    if (mins <= 0) return t('whaleTracking.time.justNow');
    if (mins < 60) return t('whaleTracking.time.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    return t('whaleTracking.time.hoursAgo', { count: hours });
  };

  // Use standardized mock hook
  const { data: positions, loading, error, reload } = useMockData<WhalePosition[]>(
    async () => {
      // Simulate filtering
      return mockPositions.filter(p => {
        if (assetFilter !== 'ALL' && p.asset !== assetFilter) return false;
        if (sideFilter !== 'ALL' && p.side !== sideFilter) return false;
        if (pnlFilter !== 'ALL') {
            const pnlValue = Number.parseFloat(p.pnlUSD.replace(/[$,]/g, ''));
            if (pnlFilter === 'PROFIT' && pnlValue < 0) return false;
            if (pnlFilter === 'LOSS' && pnlValue >= 0) return false;
        }
        return true;
      });
    },
    [assetFilter, sideFilter, pnlFilter]
  );

  const sortedPositions = useMemo(() => {
    if (!positions) return [];
    if (!sortField || !sortOrder) return positions;

    return [...positions].sort((a, b) => {
      let valA, valB;
      
      switch (sortField) {
        case 'positionValue':
          valA = Number.parseFloat(a.positionValueUSD.replace(/[$,]/g, ''));
          valB = Number.parseFloat(b.positionValueUSD.replace(/[$,]/g, ''));
          break;
        case 'pnl':
          valA = Number.parseFloat(a.pnlUSD.replace(/[$,]/g, ''));
          valB = Number.parseFloat(b.pnlUSD.replace(/[$,]/g, ''));
          break;
        case 'margin':
          valA = Number.parseFloat(a.margin.replace(/[$,]/g, ''));
          valB = Number.parseFloat(b.margin.replace(/[$,]/g, ''));
          break;
        case 'winRate':
          valA = a.winRate === '--' ? -1 : Number.parseFloat(a.winRate);
          valB = b.winRate === '--' ? -1 : Number.parseFloat(b.winRate);
          break;
        case 'createdTime':
            valA = a.createdMinutesAgo;
            valB = b.createdMinutesAgo;
            // smaller minutesAgo is more recent
            return sortOrder === 'desc' ? valA - valB : valB - valA;
        default:
          return 0;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [positions, sortField, sortOrder]);

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
          <FilterButton 
            value={pnlFilter} 
            options={[
              { value: 'ALL', label: t('common.all') },
              { value: 'PROFIT', label: t('whaleTracking.holdings.filters.profit') },
              { value: 'LOSS', label: t('whaleTracking.holdings.filters.loss') },
            ]} 
            onChange={setPnlFilter} 
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
