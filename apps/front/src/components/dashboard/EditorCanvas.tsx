'use client'

import { Layout as LayoutIcon, Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardCanvas } from '@/features/dashboards/components/DashboardCanvas'
import { ensureDashboard, getDashboard, updateDashboard } from '@/features/dashboards/store/dashboardStore'
import { AddWidgetModal } from './AddWidgetModal'

const DEFAULT_DASHBOARD_ID = 'draft'

export const EditorCanvas = () => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [doc, setDoc] = useState(() => ensureDashboard(DEFAULT_DASHBOARD_ID))

  useEffect(() => {
    const refresh = () => setDoc(getDashboard(DEFAULT_DASHBOARD_ID) ?? ensureDashboard(DEFAULT_DASHBOARD_ID))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('coinflux_dashboards_updated', refresh as any)
    }
  }, [])

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="space-y-6">
        <input
          type="text"
          placeholder={t('dashboard.editor.descriptionPlaceholder')}
          value={doc?.name ?? ''}
          onChange={(e) => {
            const next = e.target.value
            updateDashboard(DEFAULT_DASHBOARD_ID, (d) => ({ ...d, name: next }))
            setDoc(getDashboard(DEFAULT_DASHBOARD_ID) ?? ensureDashboard(DEFAULT_DASHBOARD_ID))
          }}
          className="w-full bg-transparent border-none text-white text-h1 font-bold focus:outline-none placeholder:text-[#8b949e] placeholder:opacity-50"
        />

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('dashboard.editor.addWidgetTitle')}</span>
          </button>

          <div className="h-6 w-px bg-[#30363d]" />

          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 text-[#8b949e] hover:text-white transition-colors text-xs font-medium"
          >
            <LayoutIcon className="w-3.5 h-3.5" />
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      <div className="min-h-[600px] bg-[#0d1117] rounded-xl border border-[#30363d] p-4 relative bg-grid-pattern">
        <DashboardCanvas dashboardId={DEFAULT_DASHBOARD_ID} />
      </div>

      <AddWidgetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} dashboardId={DEFAULT_DASHBOARD_ID} />

      <style jsx global>{`
        .bg-grid-pattern {
          background-image: radial-gradient(#30363d 1px, transparent 1px);
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
