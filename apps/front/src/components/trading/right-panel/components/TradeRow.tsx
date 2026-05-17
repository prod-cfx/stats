'use client';

import React from 'react';

interface TradeRowProps {
  price: string;
  amount: string;
  time: string;
  type: 'buy' | 'sell';
}

export const TradeRow = ({ price, amount, time, type }: TradeRowProps) => {
  return (
    <div className="flex h-6 cursor-pointer items-center !text-xs !font-normal !leading-5 hover:bg-[color:var(--cf-surface-hover)]">
      <div className={`w-[40%] pl-2 ${type === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {price}
      </div>
      <div className="w-[30%] pr-2 text-right text-[color:var(--cf-text)]">
        {amount}
      </div>
      <div className="w-[30%] pr-2 text-right text-[color:var(--cf-muted)]">
        {time}
      </div>
    </div>
  );
};


