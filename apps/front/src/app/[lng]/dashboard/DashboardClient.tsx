'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore'
import { Bookmark, Compass, Grid3x3, Layout } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { ExploreDashboards } from '@/components/dashboard/ExploreDashboards'
import { LoadingState } from '@/components/ui/loading'
import {
  createNewDashboard,
  DASHBOARD_UPDATED_EVENT,
  getMyDashboards,
  getSavedDashboards,
} from '@/features/dashboards/store/dashboardStore'

type TabType = 'explore' | 'my' | 'saved'

export function DashboardClient() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = (searchParams.get('tab') as TabType) || 'explore'
  const [activeTab, setActiveTab] = useState<TabType>(urlTab)
  const [loading, setLoading] = useState(false)
  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([])
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([])

  const tabs = [
    { id: 'explore', label: t('dashboard.tabs.explore'), icon: Compass },
    { id: 'my', label: t('dashboard.tabs.my'), icon: Layout },
    { id: 'saved', label: t('dashboard.tabs.saved'), icon: Bookmark },
  ]

  useEffect(() => {
    const refresh = () => {
      setMyDashboards(getMyDashboards())
      setSavedDashboards(getSavedDashboards())
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    // Sync tab state with URL, so redirects like ?tab=saved always show correct data section.
    setActiveTab(urlTab)
  }, [urlTab])

  // Transition loading: 600-1000ms
  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab)
      return
    setLoading(true)
    setActiveTab(tab)
    router.replace(`/zh/dashboard/?tab=${tab}`)
    setTimeout(() => setLoading(false), 800)
  }

  const handleCreateDashboard = () => {
    const newDash = createNewDashboard()
    router.push(`/zh/dashboard/editor?id=${newDash.id}`)
  }

  const displayDashboards = activeTab === 'my' ? myDashboards : savedDashboards

  return (
    <div className="max-w-[1440px] mx-auto w-full flex min-h-0 gap-8">
      <div className="flex-none">
        <DashboardSidebar activeTab={activeTab} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-2 border-b border-[#30363d]">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative -mb-[px] ${isActive
                    ? 'text-white bg-white/5'
                    : 'text-[#8b949e] border-transparent hover:text-white'}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-[#8b949e]'}`} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="relative min-h-[400px]">
            <LoadingState isLoading={loading}>
              <div className="animate-in fade-in duration-500">
                {activeTab === 'explore' && <ExploreDashboards />}
                
                {activeTab === 'my' && (
                  displayDashboards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#8b949e] gap-4 border-2 border-dashed border-[#30363d] rounded-2xl">
                    <Layout className="w-12 h-12" />
                    <p className="text-lg font-medium">{t('dashboard.empty.my')}</p>
                    <button
                      type="button"
                        onClick={handleCreateDashboard}
                      className="text-white bg-gradient-to-r from-primary to-secondary px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                      {t('dashboard.actions.createFirst')}
                    </button>
                  </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayDashboards.map((dash) => (
                        <button
                          key={dash.id}
                          type="button"
                          onClick={() => router.push(`/zh/dashboard/view?id=${dash.id}`)}
                          className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-[#30363d] hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/20 bg-[#161b22]"
                        >
                          {dash.thumbnail ? (
                            <div className="absolute inset-0">
                              <img
                                src={dash.thumbnail}
                                alt={dash.name}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#21262d] to-[#161b22] flex items-center justify-center">
                              <Grid3x3 className="w-16 h-16 text-[#30363d] group-hover:text-[#8b949e] transition-colors" />
                            </div>
                          )}

                          <div className="absolute inset-0 p-4 flex flex-col justify-end">
                            <h3 className="text-white font-bold text-lg mb-1 truncate group-hover:text-primary transition-colors">
                              {dash.name || '未命名看板'}
                            </h3>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8b949e]">
                                {dash.widgets?.length || 0} 个组件
                              </span>
                              <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded-full border border-green-600/30 font-medium">
                                已发布
                              </span>
                            </div>
                          </div>

                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </button>
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'saved' && (
                  displayDashboards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#8b949e] gap-4 border-2 border-dashed border-[#30363d] rounded-2xl">
                    <Bookmark className="w-12 h-12" />
                    <p className="text-lg font-medium">{t('dashboard.empty.saved')}</p>
                    <button
                      type="button"
                        onClick={handleCreateDashboard}
                        className="text-white bg-gradient-to-r from-primary to-secondary px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        {t('dashboard.actions.createFirst')}
                    </button>
                  </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayDashboards.map((dash) => (
                        <button
                          key={dash.id}
                          type="button"
                          onClick={() => router.push(`/zh/dashboard/editor?id=${dash.id}`)}
                          className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-[#30363d] hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/20 bg-[#161b22]"
                        >
                          {dash.thumbnail ? (
                            <div className="absolute inset-0">
                              <img
                                src={dash.thumbnail}
                                alt={dash.name}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#21262d] to-[#161b22] flex items-center justify-center">
                              <Grid3x3 className="w-16 h-16 text-[#30363d] group-hover:text-[#8b949e] transition-colors" />
                            </div>
                          )}

                          <div className="absolute inset-0 p-4 flex flex-col justify-end">
                            <h3 className="text-white font-bold text-lg mb-1 truncate group-hover:text-primary transition-colors">
                              {dash.name || '未命名看板'}
                            </h3>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8b949e]">
                                {dash.widgets?.length || 0} 个组件
                              </span>
                              <span className="px-2 py-0.5 bg-[#30363d] text-[#8b949e] rounded-full font-medium">
                                草稿
                              </span>
                            </div>
                          </div>

                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </LoadingState>
          </div>
        </div>
      </div>
    </div>
  )
}


