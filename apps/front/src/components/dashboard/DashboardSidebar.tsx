'use client';

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore';
import { Bookmark, ChevronDown, Grid3x3, Layout, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import {
  DASHBOARD_UPDATED_EVENT,
  deleteDashboard,
  getMyDashboards,
  getSavedDashboards,
  updateDashboardMeta,
} from '@/features/dashboards/store/dashboardStore';
import { toast } from '@/lib/toast';

interface DashboardSidebarProps {
  activeTab?: 'explore' | 'my' | 'saved';
  onDashboardClick?: (id: string) => void;
}

export const DashboardSidebar = ({ activeTab: _activeTab, onDashboardClick }: DashboardSidebarProps) => {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const lng = params.lng || 'zh';
  const isZh = String(lng).startsWith('zh');
  const tr = (key: string, fallbackZh: string, fallbackEn: string) => {
    const v = t(key);
    if (!v || v === key) return isZh ? fallbackZh : fallbackEn;
    return v;
  };

  const resolveDashboardName = (name?: string) => {
    const raw = (name ?? '').trim()
    if (!raw || raw === 'UNTITLED')
      return t('dashboard.sidebar.untitled')

    // Treat the default "Market" dashboard name as a localized label.
    // This keeps older/localStorage-created dashboards consistent across language switches.
    if (raw === '行情' || raw.toLowerCase() === 'market')
      return t('nav.home')

    return raw
  }

  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([]);
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([]);
  const [showMyDashboards, setShowMyDashboards] = useState(true);
  const [showSavedDashboards, setShowSavedDashboards] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DashboardDoc | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DashboardDoc | null>(null);

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
    <aside
      className="w-64 flex-none border-r border-[color:var(--cf-border)] p-6 flex flex-col gap-10 bg-[color:var(--cf-bg)]"
      onClick={() => setOpenMenuId(null)}
    >
      <div className="space-y-8">
        {/* My Dashboards Section */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowMyDashboards(!showMyDashboards)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Layout className="w-4 h-4 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-colors" />
              <span className="text-[color:var(--cf-muted)] text-sm font-semibold group-hover:text-[color:var(--cf-text-strong)] transition-colors">{t('dashboard.sidebar.myDashboards')}</span>
              {myDashboards.length > 0 && (
                <span className="ml-auto bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {myDashboards.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-3 h-3 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-all ${
                showMyDashboards ? '' : '-rotate-90'
              }`}
            />
          </button>
          {showMyDashboards && myDashboards.length > 0 && (
            <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
              {myDashboards.slice(0, 5).map((dash) => (
                <div key={dash.id} className="group flex items-center gap-2 rounded hover:bg-[color:var(--cf-surface-hover)] transition-colors">
                  <button
                    type="button"
                    onClick={() => handleDashboardClick(dash.id, true)}
                    className="flex-1 text-left px-3 py-2 rounded text-xs transition-colors truncate flex items-center gap-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
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
                    {resolveDashboardName(dash.name)}
                  </button>

                  <div className="relative pr-2">
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] hover:border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface)] transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="dashboard-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((v) => (v === dash.id ? null : dash.id));
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenuId === dash.id && (
                      <div
                        className="absolute right-0 mt-2 w-44 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl overflow-hidden z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]"
                          onClick={() => {
                            setOpenMenuId(null);
                            setRenameTarget(dash);
                            setRenameValue(dash.name || '');
                          }}
                        >
                          <Pencil className="w-4 h-4 text-[color:var(--cf-muted)]" />
                          {tr('common.rename', '重命名', 'Rename')}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 hover:bg-[color:var(--cf-surface-hover)]"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteTarget(dash);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('dashboard.actions.delete') || '删除'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
            <Bookmark className="w-4 h-4 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-colors" />
              <span className="text-[color:var(--cf-muted)] text-sm font-semibold group-hover:text-[color:var(--cf-text-strong)] transition-colors">{t('dashboard.sidebar.savedDashboards')}</span>
              {savedDashboards.length > 0 && (
                <span className="ml-auto bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)] px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {savedDashboards.length}
                </span>
              )}
          </div>
            <ChevronDown
              className={`w-3 h-3 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-all ${
                showSavedDashboards ? '' : '-rotate-90'
              }`}
            />
        </button>

          {showSavedDashboards && savedDashboards.length > 0 && (
            <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
              {savedDashboards.slice(0, 5).map((dash) => (
                <div key={dash.id} className="group flex items-center gap-2 rounded hover:bg-[color:var(--cf-surface-hover)] transition-colors">
                  <button
                    type="button"
                    onClick={() => handleDashboardClick(dash.id, false)}
                    className="flex-1 text-left px-3 py-2 rounded text-xs transition-colors truncate flex items-center gap-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                  >
                    {dash.thumbnail ? (
                      <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0">
                        <img src={dash.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded bg-[color:var(--cf-surface-2)] flex items-center justify-center flex-shrink-0">
                        <Grid3x3 className="w-2.5 h-2.5 text-[color:var(--cf-muted)]" />
                      </div>
                    )}
                    {resolveDashboardName(dash.name)}
                  </button>

                  <div className="relative pr-2">
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] hover:border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface)] transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="dashboard-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((v) => (v === dash.id ? null : dash.id));
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenuId === dash.id && (
                      <div
                        className="absolute right-0 mt-2 w-44 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl overflow-hidden z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]"
                          onClick={() => {
                            setOpenMenuId(null);
                            setRenameTarget(dash);
                            setRenameValue(dash.name || '');
                          }}
                        >
                          <Pencil className="w-4 h-4 text-[color:var(--cf-muted)]" />
                          {tr('common.rename', '重命名', 'Rename')}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 hover:bg-[color:var(--cf-surface-hover)]"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteTarget(dash);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('dashboard.actions.delete') || '删除'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Button */}
        <Link
          href={`/${lng}/dashboard/editor`}
          className="w-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] !text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#3b82f6]/20"
        >
          <Plus className="w-4 h-4 text-white" />
          <span className="text-sm text-white">{t('dashboard.actions.create')}</span>
        </Link>
      </div>

      {/* Rename Dialog */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => {
          setRenameTarget(null);
          setRenameValue('');
        }}
        title={tr('common.rename', '重命名', 'Rename')}
        width="max-w-md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-[color:var(--cf-surface-2)] hover:bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text-strong)] transition-colors"
              onClick={() => {
                setRenameTarget(null);
                setRenameValue('');
              }}
            >
              {t('common.cancel') || '取消'}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
              onClick={() => {
                if (!renameTarget) return;
                const next = renameValue.trim();
                if (!next) {
                  toast.error({
                    title: t('common.error') || '错误',
                    description: t('dashboard.editor.validation.titleRequired'),
                  });
                  return;
                }
                updateDashboardMeta(renameTarget.id, { name: next });
                toast.success({
                  title: t('common.success') || '成功',
                  description: t('common.saved') || '已保存',
                });
                setRenameTarget(null);
                setRenameValue('');
              }}
            >
              {t('common.save') || '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-sm text-[color:var(--cf-muted)]">{t('dashboard.editor.actions.editTitle') || '标题'}</label>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg px-3 py-2 text-[color:var(--cf-text-strong)] focus:outline-none focus:border-primary"
            placeholder={t('dashboard.sidebar.untitled')}
            autoFocus
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('dashboard.actions.delete') || '删除'}
        description={
          deleteTarget
            ? `${t('dashboard.editor.dialog.deleteDesc', { name: deleteTarget.name || t('dashboard.sidebar.untitled') })}`
            : ''
        }
        confirmText={t('dashboard.actions.delete') || '删除'}
        cancelText={t('common.cancel') || '取消'}
        confirmVariant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteDashboard(deleteTarget.id);
          toast.success({
            title: t('common.success') || '成功',
            description: t('dashboard.editor.validation.deleteSuccess') || '已删除',
          });
          setDeleteTarget(null);
        }}
      />
    </aside>
  );
};
