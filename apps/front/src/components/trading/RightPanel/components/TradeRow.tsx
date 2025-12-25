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
    <div className="flex items-center h-6 text-xs hover:bg-[#21262d] cursor-pointer">
      <div className={`w-[40%] pl-2 ${type === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {price}
      </div>
      <div className="w-[30%] text-right pr-2 text-[#c9d1d9]">
        {amount}
      </div>
      <div className="w-[30%] text-right pr-2 text-[#8b949e]">
        {time}
      </div>
    </div>
  );
};

