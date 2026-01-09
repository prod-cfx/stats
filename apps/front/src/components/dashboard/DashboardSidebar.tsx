'use client';

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore';
import { Bookmark, ChevronDown, Grid3x3, Layout, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_UPDATED_EVENT,
  getMyDashboards,
  getSavedDashboards,
} from '@/features/dashboards/store/dashboardStore';

interface DashboardSidebarProps {
  activeTab?: 'explore' | 'my' | 'saved';
  onDashboardClick?: (id: string) => void;
}

export const DashboardSidebar = ({ activeTab: _activeTab, onDashboardClick }: DashboardSidebarProps) => {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const lng = params.lng || 'zh';

  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([]);
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([]);
  const [showMyDashboards, setShowMyDashboards] = useState(true);
  const [showSavedDashboards, setShowSavedDashboards] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setMyDashboards(getMyDashboards());
      setSavedDashboards(getSavedDashboards());
    };
    refresh();
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh as any);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh as any);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleDashboardClick = (dashboardId: string, isPublished: boolean) => {
    if (onDashboardClick) {
      onDashboardClick(dashboardId);
    } else {
      if (isPublished) {
        router.push(`/${lng}/dashboard/view?id=${dashboardId}`);
      } else {
        router.push(`/${lng}/dashboard/editor?id=${dashboardId}`);
      }
    }
  };

  return (
    <aside className="w-64 flex-none border-r border-[#30363d] p-6 flex flex-col gap-10">
      <div className="space-y-8">
        {/* My Dashboards Section */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowMyDashboards(!showMyDashboards)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Layout className="w-4 h-4 text-[#c9d1d9]" />
              <span className="text-[#c9d1d9] text-sm font-semibold">{t('dashboard.sidebar.myDashboards')}</span>
              {myDashboards.length > 0 && (
                <span className="ml-auto bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {myDashboards.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-3 h-3 text-[#8b949e] group-hover:text-white transition-all ${
                showMyDashboards ? '' : '-rotate-90'
              }`}
            />
          </button>
          {showMyDashboards && myDashboards.length > 0 && (
            <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
              {myDashboards.slice(0, 5).map((dash) => (
                <button
                  key={dash.id}
                  type="button"
                  onClick={() => handleDashboardClick(dash.id, true)}
                  className="w-full text-left px-3 py-2 rounded text-xs transition-colors truncate flex items-center gap-2 text-[#8b949e] hover:bg-[#161b22] hover:text-white"
                >
                  {dash.thumbnail ? (
                    <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0">
                      <img src={dash.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Grid3x3 className="w-2.5 h-2.5 text-primary" />
                    </div>
                  )}
                  {dash.name || '未命名'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saved Dashboards Section */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowSavedDashboards(!showSavedDashboards)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Bookmark className="w-4 h-4 text-[#c9d1d9]" />
              <span className="text-[#c9d1d9] text-sm font-semibold">{t('dashboard.sidebar.savedDashboards')}</span>
              {savedDashboards.length > 0 && (
                <span className="ml-auto bg-[#30363d] text-[#8b949e] px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {savedDashboards.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-3 h-3 text-[#8b949e] group-hover:text-white transition-all ${
                showSavedDashboards ? '' : '-rotate-90'
              }`}
            />
          </button>

          {showSavedDashboards && savedDashboards.length > 0 && (
            <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
              {savedDashboards.slice(0, 5).map((dash) => (
                <button
                  key={dash.id}
                  type="button"
                  onClick={() => handleDashboardClick(dash.id, false)}
                  className="w-full text-left px-3 py-2 rounded text-xs transition-colors truncate flex items-center gap-2 text-[#8b949e] hover:bg-[#161b22] hover:text-white"
                >
                  {dash.thumbnail ? (
                    <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0">
                      <img src={dash.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded bg-[#30363d] flex items-center justify-center flex-shrink-0">
                      <Grid3x3 className="w-2.5 h-2.5 text-[#8b949e]" />
                    </div>
                  )}
                  {dash.name || '未命名'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Button */}
        <Link
          href={`/${lng}/dashboard/editor`}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">{t('dashboard.actions.create')}</span>
        </Link>
      </div>
    </aside>
  );
};

