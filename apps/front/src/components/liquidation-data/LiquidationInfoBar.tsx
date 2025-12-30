'use client';

import React from 'react';

export const LiquidationInfoBar = () => {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center">
      <p className="text-[#8b949e] text-sm">
        最近24小时, 全球共有 <span className="text-[#e6edf3]">80,090</span> 人被爆仓, 爆仓总金额为 <span className="text-[#e6edf3]">$2.22 亿</span>。
        最大单笔爆仓单发生在 <span className="text-[#e6edf3]">Hyperliquid - BTC-USD</span> 价值 <span className="text-[#e6edf3]">$443.39万</span>
      </p>
    </div>
  );
};


