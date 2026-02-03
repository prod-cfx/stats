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
  const lng = (params?.lng as string) || 'zh'
  const searchParams = useSearchParams()
  const dashboardId = searchParams?.get('id') || ''
  const [dashboard, setDashboard] = useState<DashboardDoc | null>(null)

  useEffect(() => {
    if (!dashboardId) return
    const refresh = () => {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync dashboard from storage
      setDashboard(getDashboard(dashboardId) ?? null)
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [dashboardId])

  if (!dashboardId) {
    return (
      <main className="flex min-h-0 flex-1">
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="text-[#8b949e]">{t('dashboard.view.missingId')}</div>
          </div>
        </div>
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="flex min-h-0 flex-1">
        <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
            <Link
              href={`/${lng}/dashboard/`}
              className="flex w-fit items-center gap-2 text-sm text-[#8b949e] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('dashboard.view.backToList')}</span>
            </Link>
            <div className="py-20 text-center text-[#8b949e]">{t('dashboard.view.notFound')}</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1">
      <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
          <Link
            href={`/${lng}/dashboard/`}
            className="flex w-fit items-center gap-2 text-sm text-[#8b949e] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('dashboard.view.backToList')}</span>
          </Link>

          <div className="flex items-center gap-4">
            {dashboard.thumbnail ? (
              <div className="border-primary/30 h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border">
                <img src={dashboard.thumbnail} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
            <div>
              <h1 className="text-3xl font-bold text-white">
                {dashboard.name || t('dashboard.sidebar.untitled')}
              </h1>
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
