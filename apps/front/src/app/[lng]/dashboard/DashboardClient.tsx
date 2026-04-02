'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboard-store'
import { Bookmark, Grid3x3, Layout, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingState } from '@/components/ui/loading'
import { Modal } from '@/components/ui/Modal'
import {
  createNewDashboard,
  DASHBOARD_UPDATED_EVENT,
  deleteDashboard,
  getMyDashboards,
  getSavedDashboards,
  updateDashboardMeta,
} from '@/features/dashboards/store/dashboard-store'
import { toast } from '@/lib/toast'

type TabType = 'explore' | 'my' | 'saved'

export function DashboardClient() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'zh'
  const searchParams = useSearchParams()
  const urlTabRaw = (searchParams?.get('tab') as TabType) || 'my'
  // 暂时隐藏「探索看板」，避免早期内容稀缺时干扰体验
  const urlTab: TabType = urlTabRaw === 'explore' ? 'my' : urlTabRaw
  const [activeTab, setActiveTab] = useState<TabType>(urlTab)
  const [loading, setLoading] = useState(false)
  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([])
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<DashboardDoc | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DashboardDoc | null>(null)

  const tabs = [
    { id: 'my', label: t('dashboard.tabs.my'), icon: Layout },
    { id: 'saved', label: t('dashboard.tabs.saved'), icon: Bookmark },
  ]

  const isZh = String(lng).startsWith('zh')
  const tr = (key: string, fallbackZh: string, fallbackEn: string) => {
    const v = t(key)
    // If i18n is missing, i18next often returns the key itself.
    if (!v || v === key) return isZh ? fallbackZh : fallbackEn
    return v
  }

  const resolveDashboardName = (name?: string) => {
    const raw = (name ?? '').trim()
    if (!raw || raw === 'UNTITLED') return t('dashboard.sidebar.untitled')
    if (raw === '行情' || raw.toLowerCase() === 'market') return t('nav.home')
    return raw
  }

  useEffect(() => {
    const refresh = () => {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync dashboard lists from storage
      setMyDashboards(getMyDashboards())
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync dashboard lists from storage
      setSavedDashboards(getSavedDashboards())
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    // Sync tab state with URL, so redirects like ?tab=saved always show correct data section.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- derived from URL
    setActiveTab(urlTab)
  }, [urlTab])

  // Transition loading: 600-1000ms
  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return
    setLoading(true)
    setActiveTab(tab)
    router.replace(`/${lng}/dashboard/?tab=${tab}`)
    setTimeout(() => setLoading(false), 800)
  }

  const handleCreateDashboard = () => {
    const newDash = createNewDashboard()
    router.push(`/${lng}/dashboard/editor?id=${newDash.id}`)
  }

  const displayDashboards = activeTab === 'my' ? myDashboards : savedDashboards

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-col gap-8 md:flex-row">
      <div className="hidden flex-none md:block">
        <DashboardSidebar activeTab={activeTab} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-10">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-[color:var(--cf-border)]">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`relative -mb-[px] flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text-strong)]'
                      : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-[color:var(--cf-muted)]'}`}
                  />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-0.5 bg-gradient-to-r" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="relative min-h-[400px]" onClick={() => setOpenMenuId(null)}>
            <LoadingState isLoading={loading}>
              <div className="animate-in fade-in duration-500">
                {activeTab === 'my' &&
                  (displayDashboards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[color:var(--cf-border)] py-20 text-[color:var(--cf-muted)]">
                      <Layout className="h-12 w-12" />
                      <p className="text-lg font-medium">{t('dashboard.empty.my')}</p>
                      <button
                        type="button"
                        onClick={handleCreateDashboard}
                        className="bg-primary hover:bg-primary/90 shadow-primary/15 rounded-lg px-6 py-2 font-bold text-white shadow-md transition-all"
                      >
                        {t('dashboard.actions.createFirst')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {displayDashboards.map(dash => (
                        <button
                          key={dash.id}
                          type="button"
                          onClick={() => router.push(`/${lng}/dashboard/view?id=${dash.id}`)}
                          className="group hover:border-primary/50 hover:shadow-primary/20 relative aspect-[4/3] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] transition-all hover:shadow-lg"
                        >
                          <div
                            className="absolute top-3 right-3 z-20"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]/80 text-[color:var(--cf-muted)] backdrop-blur-sm transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                              onClick={() => setOpenMenuId(v => (v === dash.id ? null : dash.id))}
                              aria-label="dashboard-actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openMenuId === dash.id && (
                              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setRenameTarget(dash)
                                    setRenameValue(dash.name || '')
                                  }}
                                >
                                  <Pencil className="h-4 w-4 text-[color:var(--cf-muted)]" />
                                  {tr('common.rename', '重命名', 'Rename')}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-[color:var(--cf-surface-hover)]"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setDeleteTarget(dash)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {t('dashboard.actions.delete') || '删除'}
                                </button>
                              </div>
                            )}
                          </div>

                          {dash.thumbnail ? (
                            <div className="absolute inset-0">
                              <img
                                src={dash.thumbnail}
                                alt={dash.name}
                                className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--cf-surface-2)]">
                              <Grid3x3 className="h-16 w-16 text-[color:var(--cf-border)] transition-colors group-hover:text-[color:var(--cf-muted)]" />
                            </div>
                          )}

                          <div className="absolute inset-0 flex flex-col justify-end p-4">
                            <h3 className="group-hover:text-primary mb-1 truncate text-lg font-bold text-[color:var(--cf-text-strong)] drop-shadow-md transition-colors">
                              {resolveDashboardName(dash.name)}
                            </h3>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[color:var(--cf-muted)] drop-shadow-md">
                                {t('dashboard.editor.componentsCount', {
                                  count: dash.widgets?.length || 0,
                                })}
                              </span>
                              <span className="rounded-full border border-green-600/30 bg-green-600/20 px-2 py-0.5 font-medium text-green-400 backdrop-blur-sm">
                                {t('dashboard.editor.status.published')}
                              </span>
                            </div>
                          </div>

                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  ))}

                {activeTab === 'saved' &&
                  (displayDashboards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[color:var(--cf-border)] py-20 text-[color:var(--cf-muted)]">
                      <Bookmark className="h-12 w-12" />
                      <p className="text-lg font-medium">{t('dashboard.empty.saved')}</p>
                      <button
                        type="button"
                        onClick={handleCreateDashboard}
                        className="bg-primary hover:bg-primary/90 shadow-primary/15 rounded-lg px-6 py-2 font-bold text-white shadow-md transition-all"
                      >
                        {t('dashboard.actions.createFirst')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {displayDashboards.map(dash => (
                        <button
                          key={dash.id}
                          type="button"
                          onClick={() => router.push(`/${lng}/dashboard/editor?id=${dash.id}`)}
                          className="group hover:border-primary/50 hover:shadow-primary/20 relative aspect-[4/3] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] transition-all hover:shadow-lg"
                        >
                          <div
                            className="absolute top-3 right-3 z-20"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]/80 text-[color:var(--cf-muted)] backdrop-blur-sm transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                              onClick={() => setOpenMenuId(v => (v === dash.id ? null : dash.id))}
                              aria-label="dashboard-actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openMenuId === dash.id && (
                              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setRenameTarget(dash)
                                    setRenameValue(dash.name || '')
                                  }}
                                >
                                  <Pencil className="h-4 w-4 text-[color:var(--cf-muted)]" />
                                  {tr('common.rename', '重命名', 'Rename')}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-[color:var(--cf-surface-hover)]"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setDeleteTarget(dash)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {t('dashboard.actions.delete') || '删除'}
                                </button>
                              </div>
                            )}
                          </div>

                          {dash.thumbnail ? (
                            <div className="absolute inset-0">
                              <img
                                src={dash.thumbnail}
                                alt={dash.name}
                                className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--cf-surface-2)]">
                              <Grid3x3 className="h-16 w-16 text-[color:var(--cf-border)] transition-colors group-hover:text-[color:var(--cf-muted)]" />
                            </div>
                          )}

                          <div className="absolute inset-0 flex flex-col justify-end p-4">
                            <h3 className="group-hover:text-primary mb-1 truncate text-lg font-bold text-[color:var(--cf-text-strong)] drop-shadow-md transition-colors">
                              {resolveDashboardName(dash.name)}
                            </h3>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[color:var(--cf-muted)] drop-shadow-md">
                                {t('dashboard.editor.componentsCount', {
                                  count: dash.widgets?.length || 0,
                                })}
                              </span>
                              <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] px-2 py-0.5 font-medium text-[color:var(--cf-muted)] backdrop-blur-sm">
                                {t('dashboard.editor.status.draft')}
                              </span>
                            </div>
                          </div>

                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  ))}
              </div>
            </LoadingState>
          </div>

          {/* Rename Dialog */}
          <Modal
            isOpen={!!renameTarget}
            onClose={() => {
              setRenameTarget(null)
              setRenameValue('')
            }}
            title={tr('common.rename', '重命名', 'Rename')}
            width="max-w-md"
            footer={
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-[color:var(--cf-surface-2)] px-4 py-2 text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                  onClick={() => {
                    setRenameTarget(null)
                    setRenameValue('')
                  }}
                >
                  {t('common.cancel') || '取消'}
                </button>
                <button
                  type="button"
                  className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-white transition-colors"
                  onClick={() => {
                    if (!renameTarget) return
                    const next = renameValue.trim()
                    if (!next) {
                      toast.error({
                        title: t('common.error') || '错误',
                        description: t('dashboard.editor.validation.titleRequired'),
                      })
                      return
                    }
                    updateDashboardMeta(renameTarget.id, { name: next })
                    toast.success({
                      title: t('common.success') || '成功',
                      description: t('common.saved') || '已保存',
                    })
                    setRenameTarget(null)
                    setRenameValue('')
                  }}
                >
                  {t('common.save') || '保存'}
                </button>
              </div>
            }
          >
            <div className="space-y-2">
              <label className="text-sm text-[color:var(--cf-muted)]">
                {t('dashboard.editor.actions.editTitle') || '标题'}
              </label>
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="focus:border-primary w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-[color:var(--cf-text-strong)] focus:outline-none"
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
                ? `${t('dashboard.editor.dialog.deleteDesc', { name: resolveDashboardName(deleteTarget.name) })}`
                : ''
            }
            confirmText={t('dashboard.actions.delete') || '删除'}
            cancelText={t('common.cancel') || '取消'}
            confirmVariant="danger"
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (!deleteTarget) return
              deleteDashboard(deleteTarget.id)
              toast.success({
                title: t('common.success') || '成功',
                description: t('dashboard.editor.validation.deleteSuccess') || '已删除',
              })
              setDeleteTarget(null)
            }}
          />
        </div>
      </div>
    </div>
  )
}
