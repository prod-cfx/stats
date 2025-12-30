'use client';

import React from 'react';

interface OrderbookRowProps {
  price: string;
  amount: string;
  total: string;
  type: 'buy' | 'sell';
  depthPercent: number;
}

export const OrderbookRow = ({ price, amount, total, type, depthPercent }: OrderbookRowProps) => {
  return (
    <div className="relative group flex items-center h-6 text-xs cursor-pointer hover:bg-[#21262d]">
      <div 
        className={`absolute right-0 top-0 bottom-0 transition-all duration-300 ${
          type === 'sell' ? 'bg-[#da3633]/15' : 'bg-[#2ea043]/15'
        }`}
        style={{ width: `${depthPercent}%` }}
      />
      
      <div className={`w-[40%] pl-2 z-10 ${type === 'sell' ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
        {price}
      </div>
      <div className="w-[30%] text-right pr-2 text-[#c9d1d9] z-10">
        {amount}
      </div>
      <div className="w-[30%] text-right pr-2 text-[#8b949e] z-10 font-mono">
        {total}
      </div>
    </div>
  );
};



