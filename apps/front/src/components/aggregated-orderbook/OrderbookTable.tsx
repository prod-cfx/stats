'use client';

import React from 'react';
import Image from 'next/image';

interface OrderItem {
  price: string;
  amount: string;
  total: string;
  exchanges: string[]; // URLs or identifiers
  depthPercent: number;
}

interface OrderbookTableProps {
  asks: OrderItem[];
  bids: OrderItem[];
  currentPrice: {
    price: string;
    usdPrice: string;
    change: string;
    changePercent: string;
  };
}

export const OrderbookTable: React.FC<OrderbookTableProps> = ({ asks, bids, currentPrice }) => {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] font-mono text-sm overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-[#30363d] text-[#8b949e] text-xs">
        <span className="w-1/4">交易所</span>
        <span className="w-1/4 text-right">价格(USDT)</span>
        <span className="w-1/4 text-right">数量(BTC)</span>
        <span className="w-1/4 text-right">总计(BTC)</span>
      </div>

      {/* Asks (Sell Orders) - Low to High from bottom to top */}
      <div className="flex-1 flex flex-col-reverse overflow-y-auto no-scrollbar">
        {asks.map((ask, i) => (
          <div key={`ask-${i}`} className="relative group flex items-center px-4 py-0.5 hover:bg-[#1f2937]/50 transition-colors">
            {/* Depth background */}
            <div 
              className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all duration-300"
              style={{ width: `${ask.depthPercent}%` }}
            />
            
            <div className="relative w-full flex items-center z-10">
              <div className="w-1/4 flex items-center gap-1">
                {ask.exchanges.map((ex, idx) => (
                  <div key={idx} className="w-4 h-4 rounded-full overflow-hidden border border-[#30363d] bg-[#161b22]">
                    <img src={ex} alt="ex" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span className="w-1/4 text-right text-red-400">{ask.price}</span>
              <span className="w-1/4 text-right text-[#e6edf3]">{ask.amount}</span>
              <span className="w-1/4 text-right text-[#8b949e]">{ask.total}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Current Price / Mark Price */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-y border-[#30363d] z-20">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">{currentPrice.price}</span>
            <span className="text-xs text-green-400 font-semibold">{currentPrice.changePercent}</span>
          </div>
          <span className="text-xs text-[#8b949e]">${currentPrice.usdPrice}</span>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-xs text-[#8b949e]">标记价格</span>
          <span className="text-xs text-[#e6edf3]">{currentPrice.price}</span>
        </div>
      </div>

      {/* Bids (Buy Orders) - High to Low */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="relative group flex items-center px-4 py-0.5 hover:bg-[#1f2937]/50 transition-colors">
            {/* Depth background */}
            <div 
              className="absolute right-0 top-0 bottom-0 bg-green-500/10 transition-all duration-300"
              style={{ width: `${bid.depthPercent}%` }}
            />
            
            <div className="relative w-full flex items-center z-10">
              <div className="w-1/4 flex items-center gap-1">
                {bid.exchanges.map((ex, idx) => (
                  <div key={idx} className="w-4 h-4 rounded-full overflow-hidden border border-[#30363d] bg-[#161b22]">
                    <img src={ex} alt="ex" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span className="w-1/4 text-right text-green-400">{bid.price}</span>
              <span className="w-1/4 text-right text-[#e6edf3]">{bid.amount}</span>
              <span className="w-1/4 text-right text-[#8b949e]">{bid.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


