'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboard-store'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar'
import { DashboardReadOnlyCanvas } from '@/features/dashboards/components/DashboardReadOnlyCanvas'
import { DASHBOARD_UPDATED_EVENT, getDashboard } from '@/features/dashboards/store/dashboard-store'
import { createSearchParamReader } from '@/lib/search-params'

export function DashboardViewClient() {
  const { t } = useTranslation()
  const params = useParams()
  const lng = (params?.lng as string) || 'zh'
  // React Doctor: page.tsx already wraps this client component in Suspense.
  // react-doctor-disable-next-line react-doctor/nextjs-no-use-search-params-without-suspense
  const searchParams = useSearchParams()
  const { get } = useMemo(() => createSearchParamReader(searchParams), [searchParams])
  const dashboardId = get('id') || ''
  const [dashboard, setDashboard] = useState<DashboardDoc | null>(null)
  const [dashboardLoaded, setDashboardLoaded] = useState(false)

  useEffect(() => {
    setDashboardLoaded(false)
    const refresh = () => {
      setDashboard(dashboardId ? getDashboard(dashboardId) : null)
      setDashboardLoaded(true)
    }
    refresh()
    if (!dashboardId) return
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
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="text-[#8b949e]">{t('dashboard.view.missingId')}</div>
          </div>
        </div>
      </main>
    )
  }

  if (!dashboardLoaded) {
    return (
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-8" />
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
            <Link
              href={`/${lng}/dashboard/`}
              className="flex w-fit items-center gap-2 text-sm text-[#8b949e] transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" />
              <span>{t('dashboard.view.backToList')}</span>
            </Link>
            <div className="py-20 text-center text-[#8b949e]">{t('dashboard.view.notFound')}</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col md:flex-row">
      <DashboardEditorSidebar dashboardId={dashboardId} mode="view" />

      <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
          <Link
            href={`/${lng}/dashboard/`}
            className="flex w-fit items-center gap-2 text-sm text-[#8b949e] transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            <span>{t('dashboard.view.backToList')}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-4">
            {dashboard.thumbnail ? (
              <div className="border-primary/30 relative size-14 flex-shrink-0 overflow-hidden rounded-lg border">
                <Image src={dashboard.thumbnail} alt="" fill sizes="56px" className="size-full object-cover" unoptimized />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold text-white md:text-3xl">
                {dashboard.name || t('dashboard.sidebar.untitled')}
              </h1>
              {dashboard.description ? (
                <div className="mt-1 break-words text-sm text-[#8b949e]">{dashboard.description}</div>
              ) : null}
            </div>
          </div>

          <DashboardReadOnlyCanvas dashboardId={dashboardId} />
        </div>
      </div>
    </main>
  )
}
