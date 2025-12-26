'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { DashboardListItem } from './DashboardListItem';

export const ExploreDashboards = () => {
  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white tracking-tight">探索看板</h1>
        
        {/* Search Input */}
        <div className="relative max-w-4xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a5a]" />
          <input 
            type="text" 
            placeholder="Search for dashboards" 
            className="w-full bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl pl-12 pr-4 py-3.5 text-base text-white focus:outline-none focus:border-[#3b82f6]/50 transition-all placeholder:text-[#adaebc]"
          />
        </div>
      </div>

      {/* Featured Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b border-[#2c2c2c]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b-2 border-white pb-4 -mb-[1px]">特色看板</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredDashboards.map((card, idx) => (
            <DashboardCard key={idx} {...card} />
          ))}
        </div>
      </div>

      {/* List Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Hot Dashboards */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white tracking-tight">热门看板</h3>
          <div className="flex flex-col gap-4">
            {hotDashboards.map((item, idx) => (
              <DashboardListItem key={idx} {...item} />
            ))}
          </div>
        </div>

        {/* Community Dashboards */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white tracking-tight">社区看板</h3>
          <div className="flex flex-col gap-4">
            {communityDashboards.map((item, idx) => (
              <DashboardListItem key={idx} {...item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const featuredDashboards = [
  {
    title: 'Bitcoin Options Data',
    tags: ['BITCOIN', 'CEX', 'TRADING'],
    saves: 4386,
    creator: 'MATTEO',
    image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&auto=format&fit=crop&q=60'
  },
  {
    title: 'US Spot Bitcoin ETF Ent...',
    tags: ['BITCOIN', 'ETF'],
    saves: 4116,
    creator: 'ARKHAMRESEARCH',
    image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&auto=format&fit=crop&q=60'
  },
  {
    title: 'Public Bitcoin Miners',
    tags: ['BITCOIN', 'MINER/VALIDATOR'],
    saves: 3546,
    creator: 'ARKHAMINTEL',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=60'
  },
  {
    title: 'Large Token Transfers t...',
    tags: [],
    saves: 296,
    creator: 'RUNNERXBT',
    image: 'https://images.unsplash.com/photo-1642104704074-907c069899f0?w=800&auto=format&fit=crop&q=60'
  }
];

const hotDashboards = [
  {
    title: 'Stablecoins',
    description: 'Top stablecoin comparison',
    creator: 'WILL',
    saves: 1518,
    image: 'https://api.dicebear.com/7.x/shapes/svg?seed=stable'
  },
  {
    title: 'Exchange Spot Data',
    description: 'BTC Historical Returns and Volume',
    creator: 'ARKHAMRESEARCH',
    saves: 747,
    image: 'https://api.dicebear.com/7.x/shapes/svg?seed=spot',
    tags: ['BITCOIN']
  }
];

const communityDashboards = [
  {
    title: 'MM Wallet tracking',
    description: 'You can find the portfolios of the top 7 market makers...',
    creator: 'VANTHUCBK',
    saves: 2290,
    image: 'https://api.dicebear.com/7.x/shapes/svg?seed=mm',
    tags: ['FUND']
  },
  {
    title: '@muststopmurad',
    description: '@how_to_onchain - TG channel for Ukrainian on-chain degens.',
    creator: 'HOW2ONCHAIN',
    saves: 1515,
    image: 'https://api.dicebear.com/7.x/shapes/svg?seed=murad'
  }
];

