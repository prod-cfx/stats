'use client';

import type {DashboardDoc} from '@/features/dashboards/store/dashboardStore';
import { Bookmark, Check, ChevronDown, Layout, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createNewDashboard, DASHBOARD_UPDATED_EVENT,  deleteDashboard, ensureDashboard, getDashboard, getMyDashboards, getSavedDashboards, publishDashboard, upsertDashboard } from '@/features/dashboards/store/dashboardStore';
import { toast } from '@/lib/toast';

interface DashboardEditorSidebarProps {
  dashboardId?: string;
  mode?: 'edit' | 'view';
}

export const DashboardEditorSidebar = ({ dashboardId = 'draft', mode = 'edit' }: DashboardEditorSidebarProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const lng = params.lng as string || 'zh';
  const [doc, setDoc] = useState(() => ensureDashboard(dashboardId));
  const [error, setError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success'>('idle');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([]);
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([]);
  const [showMyDashboards, setShowMyDashboards] = useState(false);
  const [showSavedDashboards, setShowSavedDashboards] = useState(true);
  const [showAllMyDashboards, setShowAllMyDashboards] = useState(false);
  const [showAllSavedDashboards, setShowAllSavedDashboards] = useState(false);

  const resolveDashboardName = (name?: string) => {
    const raw = (name ?? '').trim()
    if (!raw || raw.toUpperCase() === 'UNTITLED')
      return t('dashboard.sidebar.untitled')

    // Treat the default "Market" dashboard name as a localized label.
    if (raw === '行情' || raw.toLowerCase() === 'market')
      return t('nav.home')

    return raw
  }

  useEffect(() => {
    const refresh = () => {
      // IMPORTANT: do not recreate deleted dashboards implicitly
      if (dashboardId === 'draft') {
        setDoc(ensureDashboard('draft'))
      } else {
        const existing = getDashboard(dashboardId)
        if (existing) setDoc(existing)
      }
      // Always refresh lists regardless of current dashboard
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
  }, [dashboardId]);

  const validatePublish = () => {
    // 验证标题
    const rawTitle = (doc.name ?? '').trim();
    const isPlaceholderTitle =
      rawTitle.length === 0 ||
      rawTitle.toUpperCase() === 'UNTITLED' ||
      rawTitle === t('dashboard.sidebar.untitled') ||
      rawTitle === '未命名';
    if (isPlaceholderTitle) {
      setError(t('dashboard.editor.validation.titleRequired'));
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.titleRequired'),
      });
      setTimeout(() => setError(null), 3000);
      return false;
    }

    // 验证缩略图
    const hasThumb = !!doc.thumbnail;
    if (!hasThumb) {
      setError(t('dashboard.editor.validation.thumbnailRequired'));
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.thumbnailRequired'),
      });
      setTimeout(() => setError(null), 3000);
      return false;
    }

    // 验证组件数量
    const hasWidgets = doc.widgets && doc.widgets.length > 0;
    if (!hasWidgets) {
      setError(t('dashboard.editor.validation.widgetsRequired'));
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.widgetsRequired'),
        duration: 3000,
      });
      setTimeout(() => setError(null), 3000);
      return false;
    }

    setError(null);
    return true;
  };

  const handlePublish = async () => {
    if (!validatePublish()) return;
    if (publishStatus === 'publishing') return;

    setPublishStatus('publishing');
    setError(null);

    try {
      // 模拟异步发布过程（实际应该调用 API）
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let finalId = dashboardId;

      // If we are publishing the 'draft' dashboard, we must clone it to a real UUID
      // because 'draft' is filtered out of lists.
      if (dashboardId === 'draft') {
        const newId = crypto.randomUUID();
        const newDoc: DashboardDoc = {
          ...doc,
          id: newId,
          isPublished: true,
          updatedAt: Date.now(),
          createdAt: Date.now(), // Treat publish as creation for the real dash
        };
        upsertDashboard(newDoc);
        
        // Clean up the draft
        // Optional: deleteDashboard('draft') or reset it. 
        // Let's reset it to avoid confusion or just leave it. 
        // Better to reset/delete so user starts fresh next time.
        deleteDashboard('draft'); 
        
        finalId = newId;
      } else {
        publishDashboard(dashboardId);
      }

      const updated = getDashboard(finalId);
      if (!updated) {
        // If it was removed while publishing, fall back to list
        router.push(`/${lng}/dashboard/?tab=my`);
        return;
      }
      setDoc(updated);
      setPublishStatus('success');

      // 显示成功提示
      toast.success({
        title: t('dashboard.editor.validation.publishSuccess'),
        description: t('dashboard.editor.validation.publishSuccessDesc', { name: updated.name }),
        duration: 3000,
      });

      // 1.5秒后跳转到我的看板（已发布tab）
      setTimeout(() => {
        router.push(`/${lng}/dashboard/?tab=my`);
      }, 1500);
    } catch (err) {
      void err
      setPublishStatus('idle');
      setError(t('dashboard.editor.validation.publishFail'));
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.publishFailDesc'),
      });
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteClick = () => {
    // 如果正在删除，防止重复点击
    if (deleteStatus === 'deleting') return;
    // 显示确认弹窗
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    setDeleteStatus('deleting');
    setError(null);

    const dashboardName = resolveDashboardName(doc.name);
    const deletedId = dashboardId;

    try {
      // 模拟删除延迟
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 执行删除
      deleteDashboard(deletedId);
      
      // 立即刷新列表（在跳转前）
      const updatedMy = getMyDashboards();
      const updatedSaved = getSavedDashboards();
      setMyDashboards(updatedMy);
      setSavedDashboards(updatedSaved);
      
      // 成功提示
      toast.success({
        title: t('dashboard.editor.validation.deleteSuccess'),
        description: t('dashboard.editor.validation.deleteSuccessDesc', { name: dashboardName }),
        duration: 2000,
      });

      // 延迟跳转
      setTimeout(() => {
        if (updatedSaved.length > 0) {
          // 如果还有其他看板，跳转到第一个
          const nextDashboard = updatedSaved[0];
          router.push(`/${lng}/dashboard/editor?id=${nextDashboard.id}`);
        } else {
          // 如果没有看板了，跳转到列表页
          router.push(`/${lng}/dashboard/?tab=saved`);
        }
        
        // 重置删除状态
        setDeleteStatus('idle');
      }, 800);
    } catch (err) {
      void err
      setDeleteStatus('idle');
      setError(t('dashboard.editor.validation.deleteFail'));
      toast.error({
        title: t('dashboard.editor.validation.deleteFail'),
        description: t('dashboard.editor.validation.deleteFailDesc'),
        duration: 3000,
      });
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleCreateDashboard = () => {
    const newDash = createNewDashboard();
    router.push(`/${lng}/dashboard/editor?id=${newDash.id}`);
  };

  return (
    <aside className="w-64 flex-none border-r border-[color:var(--cf-border)] p-6 flex flex-col gap-10">
      <div className="flex flex-col gap-8 h-full">
        {/* Navigation Section */}
        <div className="space-y-6">
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
              <ChevronDown className={`w-3 h-3 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-all ${showMyDashboards ? '' : '-rotate-90'}`} />
            </button>
            
            {/* My Dashboards List */}
            {showMyDashboards && myDashboards.length > 0 && (
              <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                {(showAllMyDashboards ? myDashboards : myDashboards.slice(0, 5)).map((dash) => (
                  <button
                    key={dash.id}
                    type="button"
                    onClick={() => router.push(`/${lng}/dashboard/view?id=${dash.id}`)}
                    className="w-full text-left px-3 py-2 rounded text-xs text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)] transition-colors truncate"
                  >
                    {resolveDashboardName(dash.name)}
                  </button>
                ))}
                {myDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMyDashboards((v) => !v)}
                    className="w-full text-left px-3 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {showAllMyDashboards ? t('dashboard.collapse') : t('dashboard.viewAll', { count: myDashboards.length })}
                  </button>
                )}
            </div>
            )}
            {showMyDashboards && myDashboards.length === 0 && (
              <div className="pl-4 py-2 text-xs text-[color:var(--cf-muted)]">{t('dashboard.no_published')}</div>
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
              <ChevronDown className={`w-3 h-3 text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text-strong)] transition-all ${showSavedDashboards ? '' : '-rotate-90'}`} />
            </button>
            
            {/* Saved Dashboards List */}
            {showSavedDashboards && savedDashboards.length > 0 && (
              <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                {(showAllSavedDashboards ? savedDashboards : savedDashboards.slice(0, 5)).map((dash) => (
                  <button
                    key={dash.id}
                    type="button"
                    onClick={() => router.push(`/${lng}/dashboard/editor?id=${dash.id}`)}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors truncate ${
                      dash.id === dashboardId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                    }`}
                  >
                    {resolveDashboardName(dash.name)}
                  </button>
                ))}
                {savedDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSavedDashboards((v) => !v)}
                    className="w-full text-left px-3 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {showAllSavedDashboards ? t('dashboard.collapse') : t('dashboard.viewAll', { count: savedDashboards.length })}
                  </button>
                )}
              </div>
            )}
            {showSavedDashboards && savedDashboards.length === 0 && (
              <div className="pl-4 py-2 text-xs text-[color:var(--cf-muted)]">{t('dashboard.no_saved')}</div>
            )}
          </div>
        </div>

          {/* Action Buttons Section just below saved list */}
          <div className="space-y-4 pt-4 border-t border-[color:var(--cf-border)]">
            <button 
              type="button" 
              onClick={handleCreateDashboard}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            >
            <Plus className="w-4 h-4" />
            <span className="text-sm">{t('dashboard.actions.create')}</span>
          </button>
          
            {mode === 'edit' ? (
              <>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishStatus === 'publishing' || publishStatus === 'success'}
                  className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
                    publishStatus === 'publishing'
                      ? 'bg-gray-600 cursor-not-allowed'
                      : publishStatus === 'success'
                        ? 'bg-green-600 text-white'
                        : 'bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white shadow-primary/20'
                  }`}
                >
                  {publishStatus === 'publishing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm uppercase tracking-wider">{t('dashboard.editor.actions.saving')}</span>
                    </>
                  ) : publishStatus === 'success' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="text-sm uppercase tracking-wider">{t('dashboard.editor.validation.publishSuccess')}</span>
                    </>
                  ) : (
                    <>
            <Send className="w-4 h-4" />
            <span className="text-sm uppercase tracking-wider">{t('dashboard.actions.publish')}</span>
                    </>
                  )}
          </button>
                {error ? <div className="text-red-500 text-xs font-medium px-2 py-1 bg-red-500/10 rounded border border-red-500/20">{error}</div> : null}

                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={deleteStatus === 'deleting'}
                  className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all relative group ${
                    deleteStatus === 'deleting'
                      ? 'bg-red-500/20 cursor-not-allowed text-red-400 scale-[0.98]'
                      : 'bg-transparent hover:bg-red-500/10 text-[color:var(--cf-muted)] hover:text-red-500 active:scale-[0.98]'
                  }`}
                  title={deleteStatus === 'deleting' ? t('dashboard.editor.actions.deleting') : t('dashboard.actions.delete')}
                >
                  {deleteStatus === 'deleting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm uppercase tracking-wider">{t('dashboard.editor.actions.deleting')}...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="text-sm uppercase tracking-wider">{t('dashboard.actions.delete')}</span>
                    </>
                  )}
                  {deleteStatus !== 'deleting' && (
                    <div className="absolute inset-0 rounded-lg border border-red-500/0 group-hover:border-red-500/30 transition-colors pointer-events-none" />
                  )}
          </button>
              </>
            ) : null}
          </div>
        </div>

      {/* Delete Confirmation Dialog */}
      {mode === 'edit' ? (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title={t('dashboard.editor.dialog.deleteTitle')}
          description={t('dashboard.editor.dialog.deleteDesc', { name: resolveDashboardName(doc.name) })}
          confirmText={t('dashboard.editor.dialog.deleteConfirm')}
          cancelText={t('dashboard.editor.dialog.deleteCancel')}
          confirmVariant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      ) : null}
    </aside>
  );
};
