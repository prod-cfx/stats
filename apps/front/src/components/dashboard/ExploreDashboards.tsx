'use client';

import { Search } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { PageTitle, SectionTitle } from '@/components/ui/Typography';
import { DashboardCard } from './DashboardCard';
import { DashboardListItem } from './DashboardListItem';

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

export const ExploreDashboards = () => {
  const { t } = useTranslation();
  const [selectedDashboard, setSelectedDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCardClick = (card: any) => {
    setLoading(true);
    setSelectedDashboard(card);
    // Standard mock modal delay: 800-1200ms
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-6">
        <PageTitle>{t('dashboard.explore.title')}</PageTitle>
        
        {/* Search Input */}
        <div className="relative max-w-4xl group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b949e] group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder={t('dashboard.explore.searchPlaceholder')} 
            className="w-full bg-[#161b22] border border-[#30363d] rounded-xl pl-12 pr-4 py-3.5 text-body text-white focus:outline-none focus:border-primary focus:bg-[#0d1117] transition-all placeholder:text-[#8b949e]"
          />
        </div>
      </div>

      {/* Featured Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b border-[#30363d]">
          <h2 className="text-label font-bold text-white uppercase tracking-wider border-b-2 border-primary pb-4 -mb-[1px]">{t('dashboard.explore.featured')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredDashboards.map((card, idx) => (
            <div key={idx} onClick={() => handleCardClick(card)} className="cursor-pointer h-full">
              <DashboardCard {...card} />
            </div>
          ))}
        </div>
      </div>

      {/* List Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pb-12">
        {/* Hot Dashboards */}
        <div className="space-y-6">
          <SectionTitle>{t('dashboard.explore.hot')}</SectionTitle>
          <div className="flex flex-col gap-4">
            {hotDashboards.map((item, idx) => (
              <div key={idx} onClick={() => handleCardClick(item)} className="cursor-pointer">
                <DashboardListItem {...item} />
              </div>
            ))}
          </div>
        </div>

        {/* Community Dashboards */}
        <div className="space-y-6">
          <SectionTitle>{t('dashboard.explore.community')}</SectionTitle>
          <div className="flex flex-col gap-4">
            {communityDashboards.map((item, idx) => (
              <div key={idx} onClick={() => handleCardClick(item)} className="cursor-pointer">
                <DashboardListItem {...item} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedDashboard}
        onClose={() => setSelectedDashboard(null)}
        title={selectedDashboard?.title}
        width="max-w-4xl"
        loading={loading}
      >
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[#30363d]">
            <img src={selectedDashboard?.image} className="w-full h-full object-cover" alt="" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                {selectedDashboard?.creator?.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-body">@{selectedDashboard?.creator}</span>
                <span className="text-[#8b949e] text-xs">{t('dashboard.explore.publishedAgo', { days: 3 })}</span>
              </div>
              <button type="button" className="ml-auto px-6 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">
                {t('dashboard.explore.saveToMyDashboards')}
              </button>
            </div>
            <p className="text-[#c9d1d9] leading-relaxed">
              {selectedDashboard?.description || t('dashboard.explore.defaultDescription')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
