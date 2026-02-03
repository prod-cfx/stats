'use client'

import { Layout as LayoutIcon, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardCanvas } from '@/features/dashboards/components/DashboardCanvas'
import {
  ensureDashboard,
  getDashboard,
  updateDashboard,
} from '@/features/dashboards/store/dashboardStore'
import { AddWidgetModal } from './AddWidgetModal'

const DEFAULT_DASHBOARD_ID = 'draft'

interface EditorCanvasProps {
  dashboardId?: string
}

export const EditorCanvas = ({ dashboardId = DEFAULT_DASHBOARD_ID }: EditorCanvasProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const lng = (params?.lng as string) || 'zh'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [doc, setDoc] = useState(() =>
    dashboardId === DEFAULT_DASHBOARD_ID
      ? ensureDashboard(DEFAULT_DASHBOARD_ID)
      : getDashboard(dashboardId),
  )

  useEffect(() => {
    const refresh = () => {
      if (dashboardId === DEFAULT_DASHBOARD_ID) {
        setDoc(ensureDashboard(DEFAULT_DASHBOARD_ID))
        return
      }
      const existing = getDashboard(dashboardId)
      if (!existing) {
        // deleted or missing; go back to list
        router.replace(`/${lng}/dashboard/?tab=saved`)
        return
      }
      setDoc(existing)
    }
    refresh()
    window.addEventListener('storage', refresh)
    // eslint-disable-next-line react-web-api/no-leaked-event-listener
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('coinflux_dashboards_updated', refresh as any)
    }
  }, [dashboardId, router, lng])

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="space-y-6">
        <input
          type="text"
          placeholder={t('dashboard.editor.descriptionPlaceholder')}
          value={doc?.name ?? ''}
          onChange={e => {
            if (!doc) return
            const next = e.target.value
            updateDashboard(dashboardId, d => ({ ...d, name: next }))
            setDoc(getDashboard(dashboardId))
          }}
          className="text-h1 w-full border-none bg-transparent font-bold text-[color:var(--cf-text-strong)] placeholder:text-[color:var(--cf-muted)] placeholder:opacity-50 focus:outline-none"
        />

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="from-primary to-secondary shadow-primary/20 flex items-center gap-2 rounded-lg bg-gradient-to-r px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{t('dashboard.editor.addWidgetTitle')}</span>
          </button>

          <div className="h-6 w-px bg-[color:var(--cf-border)]" />

          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
          >
            <LayoutIcon className="h-3.5 w-3.5" />
            <span>{t('dashboard.resetLayout')}</span>
          </button>
        </div>
      </div>

      <div className="bg-grid-pattern relative min-h-[600px] rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
        {doc ? (
          <DashboardCanvas dashboardId={dashboardId} />
        ) : (
          <div className="py-20 text-center text-[color:var(--cf-muted)]">
            {t('dashboard.notFound')}
          </div>
        )}
      </div>

      <AddWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dashboardId={dashboardId}
      />

      <style jsx global>{`
        .bg-grid-pattern {
          background-image: radial-gradient(var(--cf-border) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .react-grid-item.react-grid-placeholder {
          background: rgba(37, 99, 235, 0.1) !important;
          border: 1px dashed #2563eb !important;
          border-radius: 12px !important;
          opacity: 1 !important;
        }
        .react-resizable-handle {
          opacity: 0;
          transition: opacity 0.2s;
        }
        .react-grid-item:hover .react-resizable-handle {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
