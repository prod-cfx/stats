'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar'
import { EditorCanvas } from '@/components/dashboard/EditorCanvas'

export function DashboardEditorClient() {
  const { t } = useTranslation()
  const params = useParams()
  const lng = (params?.lng as string) || 'zh'
  const searchParams = useSearchParams()
  const dashboardId = searchParams?.get('id') || 'draft'

  return (
    <main className="flex min-h-0 flex-1">
      {/* Sidebar */}
      <DashboardEditorSidebar dashboardId={dashboardId} />

      {/* Content Area */}
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
          {/* Back Button */}
          <Link
            href={`/${lng}/dashboard/?tab=saved`}
            className="flex w-fit items-center gap-2 text-sm text-[#8b949e] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('dashboard.editor.backToList')}</span>
          </Link>

          {/* Editor Content */}
          <EditorCanvas dashboardId={dashboardId} />
        </div>
      </div>
    </main>
  )
}
