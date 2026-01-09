'use client';

import { Bookmark, ChevronRight, Layout, Plus, Send, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DASHBOARD_UPDATED_EVENT, deleteDashboard, ensureDashboard, getDashboard, publishDashboard } from '@/features/dashboards/store/dashboardStore';

export const DashboardEditorSidebar = () => {
  const { t } = useTranslation();
  const DASHBOARD_ID = 'draft';
  const [doc, setDoc] = useState(() => ensureDashboard(DASHBOARD_ID));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setDoc(getDashboard(DASHBOARD_ID) ?? ensureDashboard(DASHBOARD_ID));
    refresh();
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh as any);
    return () => window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh as any);
  }, []);

  const ensureMetaReady = () => {
    const hasTitle = !!doc.name?.trim();
    const hasThumb = !!doc.thumbnail;
    if (hasTitle && hasThumb) {
      setError(null);
      return true;
    }
    setError('请先设置好缩略图和标题');
    return false;
  };

  const handlePublish = () => {
    if (!ensureMetaReady()) return;
    publishDashboard(DASHBOARD_ID);
    setDoc(getDashboard(DASHBOARD_ID) ?? ensureDashboard(DASHBOARD_ID));
  };

  const handleDelete = () => {
    if (!ensureMetaReady()) return;
    deleteDashboard(DASHBOARD_ID);
    setDoc(ensureDashboard(DASHBOARD_ID));
  };

  return (
    <aside className="w-64 flex-none border-r border-[#30363d] p-6 flex flex-col gap-10">
      <div className="flex flex-col gap-8 h-full">
        {/* Navigation Section */}
        <div className="space-y-8">
          {/* My Dashboards Section */}
          <div className="space-y-4">
            <button type="button" className="w-full flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Layout className="w-4 h-4 text-[#c9d1d9]" />
                <span className="text-[#c9d1d9] text-base font-semibold">{t('dashboard.sidebar.myDashboards')}</span>
              </div>
              <ChevronRight className="w-3 h-3 text-[#8b949e] group-hover:text-white transition-colors" />
            </button>
            <div className="pl-7 space-y-4">
              <div className="text-[#8b949e] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
              <div className="text-[#8b949e] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
              <div className="text-[#8b949e] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">{t('dashboard.sidebar.untitled')}</div>
            </div>
          </div>

          {/* Saved Dashboards Section */}
          <button type="button" className="w-full flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Bookmark className="w-4 h-4 text-[#c9d1d9]" />
              <span className="text-[#c9d1d9] text-base font-semibold">{t('dashboard.sidebar.savedDashboards')}</span>
            </div>
            <ChevronRight className="w-3 h-3 text-[#8b949e] group-hover:text-white transition-colors" />
          </button>

          {/* Action Buttons Section just below saved list */}
          <div className="space-y-4 pt-2">
            <button type="button" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              <span className="text-sm">{t('dashboard.actions.create')}</span>
            </button>
            
            <button
              type="button"
              onClick={handlePublish}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wider">{t('dashboard.actions.publish')}</span>
            </button>
            {error ? <div className="text-red-500 text-xs font-medium">{error}</div> : null}

            <button
              type="button"
              onClick={handleDelete}
              className="w-full bg-transparent hover:bg-red-500/10 text-[#8b949e] hover:text-red-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wider">{t('dashboard.actions.delete')}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

