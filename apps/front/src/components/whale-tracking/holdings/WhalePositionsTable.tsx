'use client';

import React, { useState } from 'react';
import { Copy, ChevronDown, TrendingUp } from 'lucide-react';
import { WhaleTradingStatsModal } from '../WhaleTradingStatsModal';

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
                        <span className="text-white text-xs font-medium">{pos.address}</span>
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

