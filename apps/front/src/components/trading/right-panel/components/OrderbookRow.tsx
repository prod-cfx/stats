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
    <div className="relative group flex h-6 cursor-pointer items-center !text-xs !font-normal !leading-5 hover:bg-[color:var(--cf-surface-hover)]">
      <div 
        className={`absolute right-0 top-0 bottom-0 transition-all duration-300 ${
          type === 'sell' ? 'bg-[#da3633]/15' : 'bg-[#2ea043]/15'
        }`}
        style={{ width: `${depthPercent}%` }}
      />
      
      <div className={`z-10 w-[40%] pl-2 ${type === 'sell' ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
        {price}
      </div>
      <div className="z-10 w-[30%] pr-2 text-right text-[color:var(--cf-text)]">
        {amount}
      </div>
      <div className="z-10 w-[30%] pr-2 text-right font-mono text-[color:var(--cf-muted)]">
        {total}
      </div>
    </div>
  );
};


