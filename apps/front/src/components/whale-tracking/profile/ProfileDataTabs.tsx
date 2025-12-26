'use client';

import React, { useState } from 'react';

type TabType = 'spot' | 'perpetual' | 'orders' | 'trades' | 'history' | 'delegation';

export const ProfileDataTabs = () => {
  const [activeTab, setActiveTab] = useState<TabType>('perpetual');

  const tabs = [
    { id: 'spot', label: '现货持仓 (1)' },
    { id: 'perpetual', label: '永续合约持仓 (3)' },
    { id: 'orders', label: '挂单 (0)' },
    { id: 'trades', label: '最近成交' },
    { id: 'history', label: '已完成交易' },
    { id: 'delegation', label: '历史委托' },
  ];

  return (
    <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl overflow-hidden flex flex-col">
      {/* Tabs Header */}
      <div className="flex px-6 border-b border-[#2c2c2c]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-6 py-4 text-sm font-bold transition-all border-b-2 -mb-[2px] ${
              activeTab === tab.id 
                ? 'text-white border-[#3b82f6]' 
                : 'text-[#888888] border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="p-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1e1e1e] text-[#999999] text-[10px] font-bold uppercase tracking-wider border-b border-[#2c2c2c]">
              <th className="px-6 py-4 text-left">币种</th>
              <th className="px-6 py-4 text-right">持仓价值</th>
              <th className="px-6 py-4 text-right">未实现盈亏</th>
              <th className="px-6 py-4 text-right">入场均价</th>
              <th className="px-6 py-4 text-right">标记价</th>
              <th className="px-6 py-4 text-right">清算价</th>
              <th className="px-6 py-4 text-right">保证金</th>
              <th className="px-6 py-4 text-right">资金费用</th>
              <th className="px-6 py-4 text-center">止盈/止损</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2c2c2c]">
            {mockPerpetualPositions.map((pos, idx) => (
              <tr key={idx} className="hover:bg-[#252525] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pos.side === 'Long' ? 'bg-[#22c55e20] text-[#4ade80]' : 'bg-[#ef444420] text-[#f87171]'}`}>
                      {pos.side === 'Long' ? '多' : '空'}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold">{pos.asset}</span>
                      <span className="text-[#999999] text-[10px] font-medium uppercase">{pos.marginType} {pos.leverage}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-bold">{pos.valueUSD}</span>
                    <span className="text-[#999999] text-xs">{pos.valueAsset}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-[#4ade80] text-sm font-bold">{pos.pnlUSD}</span>
                    <span className="text-[#4ade80] text-xs">{pos.pnlPercent}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.entryPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.markPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.liqPrice}</td>
                <td className="px-6 py-4 text-right text-white text-sm font-medium">{pos.margin}</td>
                <td className="px-6 py-4 text-right text-[#4ade80] text-sm font-medium">{pos.fundingFee}</td>
                <td className="px-6 py-4 text-center text-[#999999] text-sm font-medium">-/-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const mockPerpetualPositions = [
  {
    asset: 'BTC',
    side: 'Short',
    marginType: '全仓',
    leverage: '10x',
    valueUSD: '$ 166,034,001.73',
    valueAsset: '-1,899.07241 BTC',
    pnlUSD: '$ +1,232,483.39',
    pnlPercent: '+7.42 %',
    entryPrice: '$ 88,077.9',
    markPrice: '$ 87,429.0',
    liqPrice: '$ 97,656.0',
    margin: '$ 16,603,400.17',
    fundingFee: '$ 32,146.82'
  },
  {
    asset: 'ETH',
    side: 'Short',
    marginType: '全仓',
    leverage: '15x',
    valueUSD: '$ 54,863,721.24',
    valueAsset: '-18,527.5298 ETH',
    pnlUSD: '$ +956,913.25',
    pnlPercent: '+26.16 %',
    entryPrice: '$ 3,012.84',
    markPrice: '$ 2,961.2',
    liqPrice: '$ 4,014.61',
    margin: '$ 3,657,581.42',
    fundingFee: '$ 7,966.62'
  },
  {
    asset: 'SOL',
    side: 'Short',
    marginType: '全仓',
    leverage: '20x',
    valueUSD: '$ 18,772,607.28',
    valueAsset: '-151,209.08 SOL',
    pnlUSD: '$ +224,700.09',
    pnlPercent: '+23.94 %',
    entryPrice: '$ 125.636',
    markPrice: '$ 124.15',
    liqPrice: '$ 252.594',
    margin: '$ 1,877,260.73',
    fundingFee: '$ 1,246.82'
  }
];

