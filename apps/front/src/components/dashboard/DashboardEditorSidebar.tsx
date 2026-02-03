'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore'
import { Bookmark, Check, ChevronDown, Layout, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  createNewDashboard,
  DASHBOARD_UPDATED_EVENT,
  deleteDashboard,
  ensureDashboard,
  getDashboard,
  getMyDashboards,
  getSavedDashboards,
  publishDashboard,
  upsertDashboard,
} from '@/features/dashboards/store/dashboardStore'
import { toast } from '@/lib/toast'

interface DashboardEditorSidebarProps {
  dashboardId?: string
  mode?: 'edit' | 'view'
}

export const DashboardEditorSidebar = ({
  dashboardId = 'draft',
  mode = 'edit',
}: DashboardEditorSidebarProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'zh'

  const subscribeDashboards = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return () => {}
    }
    window.addEventListener(DASHBOARD_UPDATED_EVENT, onStoreChange as EventListener)
    window.addEventListener('storage', onStoreChange)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, onStoreChange as EventListener)
      window.removeEventListener('storage', onStoreChange)
    }
  }, [])

  const getDashboardsSnapshot = useCallback(
    () => ({
      myDashboards: getMyDashboards(),
      savedDashboards: getSavedDashboards(),
    }),
    [],
  )

  const { myDashboards, savedDashboards } = useSyncExternalStore(
    subscribeDashboards,
    getDashboardsSnapshot,
    getDashboardsSnapshot,
  )

  const getDocSnapshot = useCallback(() => {
    if (dashboardId === 'draft') return ensureDashboard('draft')
    return getDashboard(dashboardId)
  }, [dashboardId])

  const doc = useSyncExternalStore(subscribeDashboards, getDocSnapshot, getDocSnapshot)
  const [error, setError] = useState<string | null>(null)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success'>('idle')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMyDashboards, setShowMyDashboards] = useState(false)
  const [showSavedDashboards, setShowSavedDashboards] = useState(true)
  const [showAllMyDashboards, setShowAllMyDashboards] = useState(false)
  const [showAllSavedDashboards, setShowAllSavedDashboards] = useState(false)

  const resolveDashboardName = (name?: string) => {
    const raw = (name ?? '').trim()
    if (!raw || raw.toUpperCase() === 'UNTITLED') return t('dashboard.sidebar.untitled')

    // Treat the default "Market" dashboard name as a localized label.
    if (raw === '行情' || raw.toLowerCase() === 'market') return t('nav.home')

    return raw
  }

  useEffect(() => {
    // IMPORTANT: do not recreate deleted dashboards implicitly
    if (dashboardId === 'draft') return
    if (doc) return
    router.replace(`/${lng}/dashboard/?tab=saved`)
  }, [dashboardId, doc, lng, router])

  const validatePublish = () => {
    if (!doc) return false
    // 验证标题
    const rawTitle = (doc.name ?? '').trim()
    const isPlaceholderTitle =
      rawTitle.length === 0 ||
      rawTitle.toUpperCase() === 'UNTITLED' ||
      rawTitle === t('dashboard.sidebar.untitled') ||
      rawTitle === '未命名'
    if (isPlaceholderTitle) {
      setError(t('dashboard.editor.validation.titleRequired'))
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.titleRequired'),
      })
      setTimeout(() => setError(null), 3000)
      return false
    }

    // 验证缩略图
    const hasThumb = !!doc.thumbnail
    if (!hasThumb) {
      setError(t('dashboard.editor.validation.thumbnailRequired'))
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.thumbnailRequired'),
      })
      setTimeout(() => setError(null), 3000)
      return false
    }

    // 验证组件数量
    const hasWidgets = doc.widgets && doc.widgets.length > 0
    if (!hasWidgets) {
      setError(t('dashboard.editor.validation.widgetsRequired'))
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.widgetsRequired'),
        duration: 3000,
      })
      setTimeout(() => setError(null), 3000)
      return false
    }

    setError(null)
    return true
  }

  const handlePublish = async () => {
    if (!validatePublish()) return
    if (!doc) return
    if (publishStatus === 'publishing') return

    setPublishStatus('publishing')
    setError(null)

    try {
      // 模拟异步发布过程（实际应该调用 API）
      await new Promise(resolve => setTimeout(resolve, 800))

      let finalId = dashboardId

      // If we are publishing the 'draft' dashboard, we must clone it to a real UUID
      // because 'draft' is filtered out of lists.
      if (dashboardId === 'draft') {
        const newId = crypto.randomUUID()
        const base = doc
        const newDoc: DashboardDoc = {
          ...base,
          id: newId,
          isPublished: true,
          updatedAt: Date.now(),
          createdAt: Date.now(), // Treat publish as creation for the real dash
        }
        upsertDashboard(newDoc)

        // Clean up the draft
        // Optional: deleteDashboard('draft') or reset it.
        // Let's reset it to avoid confusion or just leave it.
        // Better to reset/delete so user starts fresh next time.
        deleteDashboard('draft')

        finalId = newId
      } else {
        publishDashboard(dashboardId)
      }

      const updated = getDashboard(finalId)
      if (!updated) {
        // If it was removed while publishing, fall back to list
        router.push(`/${lng}/dashboard/?tab=my`)
        return
      }
      setPublishStatus('success')

      // 显示成功提示
      toast.success({
        title: t('dashboard.editor.validation.publishSuccess'),
        description: t('dashboard.editor.validation.publishSuccessDesc', { name: updated.name }),
        duration: 3000,
      })

      // 1.5秒后跳转到我的看板（已发布tab）
      setTimeout(() => {
        router.push(`/${lng}/dashboard/?tab=my`)
      }, 1500)
    } catch (err) {
      void err
      setPublishStatus('idle')
      setError(t('dashboard.editor.validation.publishFail'))
      toast.error({
        title: t('dashboard.editor.validation.publishFail'),
        description: t('dashboard.editor.validation.publishFailDesc'),
      })
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleDeleteClick = () => {
    // 如果正在删除，防止重复点击
    if (deleteStatus === 'deleting') return
    // 显示确认弹窗
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setDeleteStatus('deleting')
    setError(null)

    if (!doc) {
      router.push(`/${lng}/dashboard/?tab=saved`)
      return
    }

    const dashboardName = resolveDashboardName(doc.name)
    const deletedId = dashboardId

    try {
      // 模拟删除延迟
      await new Promise(resolve => setTimeout(resolve, 600))

      // 执行删除
      deleteDashboard(deletedId)

      const updatedSaved = getSavedDashboards()

      // 成功提示
      toast.success({
        title: t('dashboard.editor.validation.deleteSuccess'),
        description: t('dashboard.editor.validation.deleteSuccessDesc', { name: dashboardName }),
        duration: 2000,
      })

      // 延迟跳转
      setTimeout(() => {
        if (updatedSaved.length > 0) {
          // 如果还有其他看板，跳转到第一个
          const nextDashboard = updatedSaved[0]
          router.push(`/${lng}/dashboard/editor?id=${nextDashboard.id}`)
        } else {
          // 如果没有看板了，跳转到列表页
          router.push(`/${lng}/dashboard/?tab=saved`)
        }

        // 重置删除状态
        setDeleteStatus('idle')
      }, 800)
    } catch (err) {
      void err
      setDeleteStatus('idle')
      setError(t('dashboard.editor.validation.deleteFail'))
      toast.error({
        title: t('dashboard.editor.validation.deleteFail'),
        description: t('dashboard.editor.validation.deleteFailDesc'),
        duration: 3000,
      })
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  const handleCreateDashboard = () => {
    const newDash = createNewDashboard()
    router.push(`/${lng}/dashboard/editor?id=${newDash.id}`)
  }

  return (
    <aside className="flex w-64 flex-none flex-col gap-10 border-r border-[color:var(--cf-border)] p-6">
      <div className="flex h-full flex-col gap-8">
        {/* Navigation Section */}
        <div className="space-y-6">
          {/* My Dashboards Section */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowMyDashboards(!showMyDashboards)}
              className="group flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Layout className="h-4 w-4 text-[color:var(--cf-muted)] transition-colors group-hover:text-[color:var(--cf-text-strong)]" />
                <span className="text-sm font-semibold text-[color:var(--cf-muted)] transition-colors group-hover:text-[color:var(--cf-text-strong)]">
                  {t('dashboard.sidebar.myDashboards')}
                </span>
                {myDashboards.length > 0 && (
                  <span className="bg-primary/20 text-primary ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold">
                    {myDashboards.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-3 w-3 text-[color:var(--cf-muted)] transition-all group-hover:text-[color:var(--cf-text-strong)] ${showMyDashboards ? '' : '-rotate-90'}`}
              />
            </button>

            {/* My Dashboards List */}
            {showMyDashboards && myDashboards.length > 0 && (
              <div className="animate-in slide-in-from-top-2 fade-in space-y-1 pl-4 duration-200">
                {(showAllMyDashboards ? myDashboards : myDashboards.slice(0, 5)).map(dash => (
                  <button
                    key={dash.id}
                    type="button"
                    onClick={() => router.push(`/${lng}/dashboard/view?id=${dash.id}`)}
                    className="w-full truncate rounded px-3 py-2 text-left text-xs text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                  >
                    {resolveDashboardName(dash.name)}
                  </button>
                ))}
                {myDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMyDashboards(v => !v)}
                    className="text-primary hover:text-primary/80 w-full px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    {showAllMyDashboards
                      ? t('dashboard.collapse')
                      : t('dashboard.viewAll', { count: myDashboards.length })}
                  </button>
                )}
              </div>
            )}
            {showMyDashboards && myDashboards.length === 0 && (
              <div className="py-2 pl-4 text-xs text-[color:var(--cf-muted)]">
                {t('dashboard.no_published')}
              </div>
            )}
          </div>

          {/* Saved Dashboards Section */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSavedDashboards(!showSavedDashboards)}
              className="group flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Bookmark className="h-4 w-4 text-[color:var(--cf-muted)] transition-colors group-hover:text-[color:var(--cf-text-strong)]" />
                <span className="text-sm font-semibold text-[color:var(--cf-muted)] transition-colors group-hover:text-[color:var(--cf-text-strong)]">
                  {t('dashboard.sidebar.savedDashboards')}
                </span>
                {savedDashboards.length > 0 && (
                  <span className="ml-auto rounded bg-[color:var(--cf-surface-2)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--cf-muted)]">
                    {savedDashboards.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`h-3 w-3 text-[color:var(--cf-muted)] transition-all group-hover:text-[color:var(--cf-text-strong)] ${showSavedDashboards ? '' : '-rotate-90'}`}
              />
            </button>

            {/* Saved Dashboards List */}
            {showSavedDashboards && savedDashboards.length > 0 && (
              <div className="animate-in slide-in-from-top-2 fade-in space-y-1 pl-4 duration-200">
                {(showAllSavedDashboards ? savedDashboards : savedDashboards.slice(0, 5)).map(
                  dash => (
                    <button
                      key={dash.id}
                      type="button"
                      onClick={() => router.push(`/${lng}/dashboard/editor?id=${dash.id}`)}
                      className={`w-full truncate rounded px-3 py-2 text-left text-xs transition-colors ${
                        dash.id === dashboardId
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                      }`}
                    >
                      {resolveDashboardName(dash.name)}
                    </button>
                  ),
                )}
                {savedDashboards.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSavedDashboards(v => !v)}
                    className="text-primary hover:text-primary/80 w-full px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    {showAllSavedDashboards
                      ? t('dashboard.collapse')
                      : t('dashboard.viewAll', { count: savedDashboards.length })}
                  </button>
                )}
              </div>
            )}
            {showSavedDashboards && savedDashboards.length === 0 && (
              <div className="py-2 pl-4 text-xs text-[color:var(--cf-muted)]">
                {t('dashboard.no_saved')}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Section just below saved list */}
        <div className="space-y-4 border-t border-[color:var(--cf-border)] pt-4">
          <button
            type="button"
            onClick={handleCreateDashboard}
            className="from-primary to-secondary shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r py-3 font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">{t('dashboard.actions.create')}</span>
          </button>

          {mode === 'edit' ? (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishStatus === 'publishing' || publishStatus === 'success'}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold shadow-lg transition-all active:scale-[0.98] ${
                  publishStatus === 'publishing'
                    ? 'cursor-not-allowed bg-gray-600'
                    : publishStatus === 'success'
                      ? 'bg-green-600 text-white'
                      : 'from-primary to-secondary shadow-primary/20 bg-gradient-to-r text-white hover:opacity-90'
                }`}
              >
                {publishStatus === 'publishing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm tracking-wider uppercase">
                      {t('dashboard.editor.actions.saving')}
                    </span>
                  </>
                ) : publishStatus === 'success' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span className="text-sm tracking-wider uppercase">
                      {t('dashboard.editor.validation.publishSuccess')}
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span className="text-sm tracking-wider uppercase">
                      {t('dashboard.actions.publish')}
                    </span>
                  </>
                )}
              </button>
              {error ? (
                <div className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleteStatus === 'deleting'}
                className={`group relative flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold transition-all ${
                  deleteStatus === 'deleting'
                    ? 'scale-[0.98] cursor-not-allowed bg-red-500/20 text-red-400'
                    : 'bg-transparent text-[color:var(--cf-muted)] hover:bg-red-500/10 hover:text-red-500 active:scale-[0.98]'
                }`}
                title={
                  deleteStatus === 'deleting'
                    ? t('dashboard.editor.actions.deleting')
                    : t('dashboard.actions.delete')
                }
              >
                {deleteStatus === 'deleting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm tracking-wider uppercase">
                      {t('dashboard.editor.actions.deleting')}...
                    </span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span className="text-sm tracking-wider uppercase">
                      {t('dashboard.actions.delete')}
                    </span>
                  </>
                )}
                {deleteStatus !== 'deleting' && (
                  <div className="pointer-events-none absolute inset-0 rounded-lg border border-red-500/0 transition-colors group-hover:border-red-500/30" />
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
          description={t('dashboard.editor.dialog.deleteDesc', {
            name: doc ? resolveDashboardName(doc.name) : '',
          })}
          confirmText={t('dashboard.editor.dialog.deleteConfirm')}
          cancelText={t('dashboard.editor.dialog.deleteCancel')}
          confirmVariant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      ) : null}
    </aside>
  )
}
