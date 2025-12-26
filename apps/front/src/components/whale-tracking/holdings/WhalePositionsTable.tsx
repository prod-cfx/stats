'use client';

import React, { useState } from 'react';
import { Copy, ChevronDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
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
    address: '0xb5...40',
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
    address: '0x70...10',
    tags: [
      { label: '稳健', color: '#facc15', bg: '#eab30833' },
    ],
    asset: 'ETH',
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
    address: '0x6b...b8',
    tags: [
      { label: '巨鲸', color: '#c084fc', bg: '#a855f733' },
    ],
    asset: 'ETH',
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
  },
  {
    address: '0x38...10',
    tags: [
      { label: '趋势', color: '#4ade80', bg: '#22c55e33' },
    ],
    asset: 'ETH',
    side: 'Long',
    leverage: '25x',
    marginType: 'Isolated',
    positionValueUSD: '$2,781,032.63',
    positionValueAsset: '944.8 ETH',
    pnlUSD: '$+22,578.28',
    pnlPercent: '+20.30%',
    margin: '$111,241.31',
    entryPrice: '$2919.6',
    liqPrice: '$2859.6',
    winRate: '91%',
    createdTime: '1 小时前',
    remark: 'The Collected Whale...',
  },
  {
    address: '0x35...09',
    tags: [
      { label: '风险', color: '#f87171', bg: '#ef444433' },
    ],
    asset: 'ETH',
    side: 'Long',
    leverage: '20x',
    marginType: 'Isolated',
    positionValueUSD: '$2,942,900',
    positionValueAsset: '1,000 ETH',
    pnlUSD: '$+23,700.00',
    pnlPercent: '+16.11%',
    margin: '$147,145.00',
    entryPrice: '$2919.2',
    liqPrice: '$1983.2',
    winRate: '65%',
    createdTime: '1 小时前',
    remark: '-',
  },
];

export const WhalePositionsTable = () => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleShowStats = (address: string) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">鲸鱼持仓</h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#cccccc] text-sm font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>ETH</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#cccccc] text-sm font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>所有方向</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#cccccc] text-sm font-medium hover:border-[#3b82f6]/50 transition-all">
            <span>所有未实现盈亏</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#999999] text-[10px] font-bold uppercase tracking-wider border-b border-[#2c2c2c]">
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
            <tbody className="divide-y divide-[#2c2c2c]">
              {mockPositions.map((pos, idx) => (
                <tr key={idx} className="hover:bg-[#252525] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/whale-tracking/profile/${pos.address}`}
                          className="text-white text-xs font-medium hover:underline decoration-[#3b82f6] decoration-2 underline-offset-4 transition-all"
                        >
                          {pos.address}
                        </Link>
                        <button className="text-[#666666] hover:text-white transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {pos.tags.map((tag, tIdx) => (
                          <span 
                            key={tIdx}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
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
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pos.side === 'Long' ? 'bg-[#22c55e33] text-[#4ade80]' : 'bg-[#ef444433] text-[#f87171]'}`}>
                        {pos.side === 'Long' ? '多' : '空'}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white text-sm font-bold">{pos.asset}</span>
                        <span className="text-[#999999] text-[10px]">{pos.marginType} {pos.leverage}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-sm font-medium">{pos.positionValueUSD}</span>
                      <span className="text-[#999999] text-[10px]">{pos.positionValueAsset}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-sm font-medium ${pos.pnlUSD.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                        {pos.pnlUSD}
                      </span>
                      <span className={`text-[10px] ${pos.pnlPercent.includes('+') ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                        {pos.pnlPercent}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white text-sm">
                    {pos.margin}
                  </td>
                  <td className="px-6 py-4 text-white text-sm">
                    {pos.entryPrice}
                  </td>
                  <td className="px-6 py-4 text-white text-sm">
                    {pos.liqPrice}
                  </td>
                  <td className="px-6 py-4 text-white text-sm">
                    <span className={pos.winRate !== '--' && parseInt(pos.winRate) > 70 ? 'text-[#4ade80]' : ''}>
                      {pos.winRate}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#999999] text-sm">
                    {pos.createdTime}
                  </td>
                  <td className="px-6 py-4 text-[#cccccc] text-[10px] max-w-[150px] truncate">
                    {pos.remark}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      className="w-8 h-8 mx-auto flex items-center justify-center bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-[#aaaaaa] hover:text-white active:scale-95 transition-all"
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
      </div>

      <WhaleTradingStatsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={selectedAddress || ''}
      />
    </div>
  );
};
