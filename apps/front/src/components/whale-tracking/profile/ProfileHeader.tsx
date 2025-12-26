'use client';

import React from 'react';
import { Copy, Activity, Share2 } from 'lucide-react';

interface ProfileHeaderProps {
  address: string;
}

export const ProfileHeader = ({ address }: ProfileHeaderProps) => {
  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#2c2c2c] flex items-center justify-center border border-[#30363d]">
          <Activity className="w-6 h-6 text-purple-500" />
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">{formatAddress(address)}</h1>
          <button className="text-[#666666] hover:text-white transition-colors">
            <Copy className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#e5e5e5] text-sm font-medium hover:border-[#3b82f6]/50 transition-all">
          <Activity className="w-4 h-4" />
          <span>实时数据</span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#999999] hover:text-white transition-all">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

