'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar'
import { DashboardReadOnlyCanvas } from '@/features/dashboards/components/DashboardReadOnlyCanvas'
import { DASHBOARD_UPDATED_EVENT, getDashboard } from '@/features/dashboards/store/dashboardStore'

export function DashboardViewClient() {
  const { t } = useTranslation()
  const params = useParams()
  const lng = params.lng as string || 'zh'
  const searchParams = useSearchParams()
  const dashboardId = searchParams.get('id') || ''
  const [dashboard, setDashboard] = useState<DashboardDoc | null>(null)

  useEffect(() => {
    if (!dashboardId) return
    const refresh = () => {
      setDashboard(getDashboard(dashboardId) ?? null)
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
      window.removeEventListener('storage', refresh)
    }
  }, [dashboardId])

  if (!dashboardId) {
    return (
      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-[1440px] mx-auto w-full">
            <div className="text-[#8b949e]">{t('dashboard.view.missingId')}</div>
          </div>
        </div>
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="flex-1 flex min-h-0">
        <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
            <Link
              href={`/${lng}/dashboard/`}
              className="flex items-center gap-2 text-[#8b949e] hover:text-white transition-colors text-sm w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('dashboard.view.backToList')}</span>
            </Link>
            <div className="text-center text-[#8b949e] py-20">{t('dashboard.view.notFound')}</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex min-h-0">
      <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
          <Link
            href={`/${lng}/dashboard/`}
            className="flex items-center gap-2 text-[#8b949e] hover:text-white transition-colors text-sm w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('dashboard.view.backToList')}</span>
          </Link>

          <div className="flex items-center gap-4">
            {dashboard.thumbnail ? (
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-primary/30 flex-shrink-0">
                <img src={dashboard.thumbnail} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div>
              <h1 className="text-3xl font-bold text-white">{dashboard.name || t('dashboard.sidebar.untitled')}</h1>
              {dashboard.description ? (
                <div className="mt-1 text-sm text-[#8b949e]">{dashboard.description}</div>
              ) : null}
            </div>
          </div>

          <DashboardReadOnlyCanvas dashboardId={dashboardId} />
        </div>
      </div>
    </main>
  )
}

