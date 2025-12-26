'use client';

import React, { useState } from 'react';
import { Copy, Play, Pause, ChevronRight } from 'lucide-react';

interface WhaleTransaction {
  address: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  asset: string;
  side: 'Long' | 'Short';
  marginType: 'Cross' | 'Isolated';
  positionValueUSD: string;
  positionValueAsset: string;
  entryPrice: string;
  winRate: string;
  time: string;
}

const mockTransactions: WhaleTransaction[] = [
  {
    address: '0x48...af',
    tag: '波段交易者',
    tagColor: '#60a5fa',
    tagBg: '#3b82f633',
    asset: 'BTC',
    side: 'Short',
    marginType: 'Cross',
    positionValueUSD: '$1,017,138.41',
    positionValueAsset: '-11.62816 BTC',
    entryPrice: '$87502.6',
    winRate: '68%',
    time: '23 分钟前',
  },
  {
    address: '0x7e...fd',
    tag: '趋势跟随',
    tagColor: '#c084fc',
    tagBg: '#a855f733',
    asset: 'BTC',
    side: 'Long',
    marginType: 'Cross',
    positionValueUSD: '$4,473,877.57',
    positionValueAsset: '52.06421 BTC',
    entryPrice: '$86148.8',
    winRate: '72%',
    time: '23 分钟前',
  },
  {
    address: '0x97...a0',
    tag: '大户',
    tagColor: '#94a3b8',
    tagBg: '#64748b33',
    asset: 'BTC',
    side: 'Long',
    marginType: 'Cross',
    positionValueUSD: '$1,906,025.17',
    positionValueAsset: '21.68994 BTC',
    entryPrice: '$87560.7',
    winRate: '68%',
    time: '23 分钟前',
  },
  {
    address: '0xf1...5c',
    tag: '高频交易',
    tagColor: '#fb923c',
    tagBg: '#f9731633',
    asset: 'XRP',
    side: 'Short',
    marginType: 'Cross',
    positionValueUSD: '$1,344,013.50',
    positionValueAsset: '-697,609 XRP',
    entryPrice: '$1.9263',
    winRate: '65%',
    time: '38 分钟前',
  },
  {
    address: '0xd6...ee',
    tag: '套利大师',
    tagColor: '#22d3ee',
    tagBg: '#06b6d433',
    asset: 'ETH',
    side: 'Short',
    marginType: 'Cross',
    positionValueUSD: '$1,034,390.00',
    positionValueAsset: '-350 ETH',
    entryPrice: '$2957.84',
    winRate: '78%',
    time: '39 分钟前',
  },
  {
    address: '0xdf...dd',
    tag: '多头大户',
    tagColor: '#4ade80',
    tagBg: '#22c55e33',
    asset: 'BTC',
    side: 'Long',
    marginType: 'Cross',
    positionValueUSD: '$1,882,655.17',
    positionValueAsset: '21.42546 BTC',
    entryPrice: '$87406.2',
    winRate: '38%',
    time: '41 分钟前',
  },
  {
    address: '0xdf...51',
    tag: '反转猎手',
    tagColor: '#f472b6',
    tagBg: '#ec489933',
    asset: 'ETH',
    side: 'Short',
    marginType: 'Isolated',
    positionValueUSD: '$1,082,913.92',
    positionValueAsset: '-366.1957 ETH',
    entryPrice: '$2963.11',
    winRate: '61%',
    time: '58 分钟前',
  },
];

export const RealtimeWhalesTable = () => {
  const [isPaused, setIsPaused] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">实时巨鲸</h1>
        <button 
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2c2c2c] rounded-full text-[#cccccc] text-sm font-medium hover:border-[#3b82f6]/50 transition-all active:scale-95"
        >
          {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          <span>{isPaused ? '已暂停' : '实时中'}</span>
        </button>
      </div>

      <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#999999] text-sm font-medium border-b border-[#2c2c2c]">
                <th className="px-6 py-4 text-left font-medium">地址</th>
                <th className="px-6 py-4 text-left font-medium">币种</th>
                <th className="px-6 py-4 text-left font-medium">持仓价值</th>
                <th className="px-6 py-4 text-left font-medium">开盘价</th>
                <th className="px-6 py-4 text-left font-medium">胜率</th>
                <th className="px-6 py-4 text-right font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2c2c2c]">
              {mockTransactions.map((tx, idx) => (
                <tr key={idx} className="hover:bg-[#252525] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-base font-medium">{tx.address}</span>
                        <button className="text-[#666666] hover:text-white transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span 
                        className="w-fit px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ color: tx.tagColor, backgroundColor: tx.tagBg }}
                      >
                        {tx.tag}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.side === 'Long' ? 'bg-[#22c55e33] text-[#4ade80]' : 'bg-[#ef444433] text-[#f87171]'}`}>
                        {tx.side === 'Long' ? '多' : '空'}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white text-base font-bold">{tx.asset}</span>
                        <span className="text-[#999999] text-[10px]">{tx.marginType === 'Cross' ? '全仓' : '逐仓'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-base font-medium">{tx.positionValueUSD}</span>
                      <span className="text-[#999999] text-xs">{tx.positionValueAsset}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-white text-base">
                    {tx.entryPrice}
                  </td>
                  <td className="px-6 py-5 text-[#4ade80] text-base font-semibold">
                    {tx.winRate}
                  </td>
                  <td className="px-6 py-5 text-[#999999] text-sm text-right">
                    {tx.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

