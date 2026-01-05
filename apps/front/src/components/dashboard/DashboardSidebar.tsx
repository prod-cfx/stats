'use client';

import { Bookmark, ChevronRight, Layout, Plus } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const DashboardSidebar = () => {
  const { t } = useTranslation();
  return (
    <aside className="w-64 flex-none border-r border-[#30363d] p-6 flex flex-col gap-10">
      <div className="space-y-8">
        {/* My Dashboards Section */}
        <div className="space-y-4">
          <button type="button" className="w-full flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Layout className="w-4 h-4 text-[#c9d1d9]" />
              <span className="text-[#c9d1d9] text-body font-semibold">{t('dashboard.sidebar.myDashboards')}</span>
            </div>
            <ChevronRight className="w-3 h-3 text-[#8b949e] group-hover:text-white transition-colors" />
          </button>
          <div className="pl-7 space-y-4">
            <div className="text-[#8b949e] text-caption hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
            <div className="text-[#8b949e] text-caption hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
            <div className="text-[#8b949e] text-caption hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
          </div>
        </div>

        {/* Tracked Entities */}
        <div className="text-[#8b949e] text-caption font-bold uppercase tracking-[0.1em]">
          {t('dashboard.sidebar.trackedEntities')}
        </div>

        {/* Saved Dashboards Section */}
        <button type="button" className="w-full flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <Bookmark className="w-4 h-4 text-[#c9d1d9]" />
            <span className="text-[#c9d1d9] text-body font-semibold">{t('dashboard.sidebar.savedDashboards')}</span>
          </div>
          <ChevronRight className="w-3 h-3 text-[#8b949e] group-hover:text-white transition-colors" />
        </button>

        {/* Create Button moved here */}
        <Link href="/dashboard/editor" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          <span className="text-label">{t('dashboard.actions.create')}</span>
        </Link>
      </div>
    </aside>
  );
};

