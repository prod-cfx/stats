'use client';

import type {DashboardDoc} from '@/features/dashboards/store/dashboardStore';
import { Bookmark, Check, ChevronDown, Layout, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createNewDashboard, DASHBOARD_UPDATED_EVENT,  deleteDashboard, ensureDashboard, getDashboard, getMyDashboards, getSavedDashboards, publishDashboard } from '@/features/dashboards/store/dashboardStore';
import { toast } from '@/lib/toast';

interface DashboardEditorSidebarProps {
  dashboardId?: string;
  mode?: 'edit' | 'view';
}

export const DashboardEditorSidebar = ({ dashboardId = 'draft', mode = 'edit' }: DashboardEditorSidebarProps) => {
  const { t } = useTranslation();
  const router = useRouter();
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

  useEffect(() => {
    const refresh = () => {
      // IMPORTANT: do not recreate deleted dashboards implicitly
      if (dashboardId === 'draft') {
        setDoc(ensureDashboard('draft'))
        return
      }
      const existing = getDashboard(dashboardId)
      if (existing) setDoc(existing)
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
    const hasTitle = !!doc.name?.trim();
    if (!hasTitle) {
      setError('请先设置看板标题');
      toast.error({
        title: '无法发布',
        description: '请先设置看板标题',
      });
      setTimeout(() => setError(null), 3000);
      return false;
    }

    // 验证缩略图
    const hasThumb = !!doc.thumbnail;
    if (!hasThumb) {
      setError('请先上传缩略图');
      toast.error({
        title: '无法发布',
        description: '请先上传缩略图',
      });
      setTimeout(() => setError(null), 3000);
      return false;
    }

    // 验证组件数量
    const hasWidgets = doc.widgets && doc.widgets.length > 0;
    if (!hasWidgets) {
      setError('请至少添加一个组件');
      toast.error({
        title: '无法发布',
        description: '看板内容不能为空，请至少添加一个组件',
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
      
      publishDashboard(dashboardId);
      const updated = getDashboard(dashboardId) ?? (dashboardId === 'draft' ? ensureDashboard(dashboardId) : null);
      if (!updated) {
        // If it was removed while publishing, fall back to list
        router.push('/zh/dashboard/?tab=my');
        return;
      }
      setDoc(updated);
      setPublishStatus('success');

      // 显示成功提示
      toast.success({
        title: '发布成功',
        description: `看板 "${updated.name}" 已成功发布`,
        duration: 3000,
      });

      // 1.5秒后跳转到我的看板（已发布tab）
      setTimeout(() => {
        router.push('/zh/dashboard/?tab=my');
      }, 1500);
    } catch (err) {
      void err
      setPublishStatus('idle');
      setError('发布失败，请重试');
      toast.error({
        title: '发布失败',
        description: '发布看板时出现错误，请稍后重试',
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

    const dashboardName = doc.name || '未命名看板';
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
        title: '删除成功',
        description: `看板 "${dashboardName}" 已删除`,
        duration: 2000,
      });

      // 延迟跳转
      setTimeout(() => {
        if (updatedSaved.length > 0) {
          // 如果还有其他看板，跳转到第一个
          const nextDashboard = updatedSaved[0];
          router.push(`/zh/dashboard/editor?id=${nextDashboard.id}`);
        } else {
          // 如果没有看板了，跳转到列表页
          router.push('/zh/dashboard/?tab=saved');
        }
        
        // 重置删除状态
        setDeleteStatus('idle');
      }, 800);
    } catch (err) {
      void err
      setDeleteStatus('idle');
      setError('删除失败，请重试');
      toast.error({
        title: '删除失败',
        description: '删除看板时出现错误，请稍后重试',
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
    router.push(`/zh/dashboard/editor?id=${newDash.id}`);
  };

  return (
    <aside className="w-64 flex-none border-r border-[#30363d] p-6 flex flex-col gap-10">
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
                <Layout className="w-4 h-4 text-[#c9d1d9]" />
                <span className="text-[#c9d1d9] text-sm font-semibold">{t('dashboard.sidebar.myDashboards')}</span>
                {myDashboards.length > 0 && (
                  <span className="ml-auto bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {myDashboards.length}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3 h-3 text-[#8b949e] group-hover:text-white transition-all ${showMyDashboards ? '' : '-rotate-90'}`} />
            </button>
            
            {/* My Dashboards List */}
            {showMyDashboards && myDashboards.length > 0 && (
              <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                {(showAllMyDashboards ? myDashboards : myDashboards.slice(0, 5)).map((dash) => (
                  <button
                    key={dash.id}
                    type="button"
                    onClick={() => router.push(`/zh/dashboard/view?id=${dash.id}`)}
                    className="w-full text-left px-3 py-2 rounded text-xs text-[#8b949e] hover:bg-[#161b22] hover:text-white transition-colors truncate"
                  >
                    {dash.name || '未命名'}
                  </button>
                ))}
                {myDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMyDashboards((v) => !v)}
                    className="w-full text-left px-3 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {showAllMyDashboards ? '收起' : `查看全部 ${myDashboards.length} 个...`}
                  </button>
                )}
              </div>
            )}
            {showMyDashboards && myDashboards.length === 0 && (
              <div className="pl-4 py-2 text-xs text-[#8b949e]">暂无已发布的看板</div>
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
              <ChevronDown className={`w-3 h-3 text-[#8b949e] group-hover:text-white transition-all ${showSavedDashboards ? '' : '-rotate-90'}`} />
            </button>
            
            {/* Saved Dashboards List */}
            {showSavedDashboards && savedDashboards.length > 0 && (
              <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                {(showAllSavedDashboards ? savedDashboards : savedDashboards.slice(0, 5)).map((dash) => (
                  <button
                    key={dash.id}
                    type="button"
                    onClick={() => router.push(`/zh/dashboard/editor?id=${dash.id}`)}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors truncate ${
                      dash.id === dashboardId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-[#8b949e] hover:bg-[#161b22] hover:text-white'
                    }`}
                  >
                    {dash.name || '未命名'}
                  </button>
                ))}
                {savedDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSavedDashboards((v) => !v)}
                    className="w-full text-left px-3 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {showAllSavedDashboards ? '收起' : `查看全部 ${savedDashboards.length} 个...`}
                  </button>
                )}
              </div>
            )}
            {showSavedDashboards && savedDashboards.length === 0 && (
              <div className="pl-4 py-2 text-xs text-[#8b949e]">暂无已保存的看板</div>
            )}
          </div>

          {/* Action Buttons Section just below saved list */}
          <div className="space-y-4 pt-4 border-t border-[#30363d]">
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
                      <span className="text-sm uppercase tracking-wider">发布中...</span>
                    </>
                  ) : publishStatus === 'success' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="text-sm uppercase tracking-wider">发布成功</span>
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
                      : 'bg-transparent hover:bg-red-500/10 text-[#8b949e] hover:text-red-500 active:scale-[0.98]'
                  }`}
                  title={deleteStatus === 'deleting' ? '删除中，请稍候...' : '删除看板'}
                >
                  {deleteStatus === 'deleting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm uppercase tracking-wider">删除中...</span>
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
      </div>

      {/* Delete Confirmation Dialog */}
      {mode === 'edit' ? (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="确认删除看板"
          description={`确定要删除看板 "${doc.name || '未命名看板'}" 吗？\n\n此操作无法撤销，所有数据将永久丢失。`}
          confirmText="删除"
          cancelText="取消"
          confirmVariant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      ) : null}
    </aside>
  );
};

