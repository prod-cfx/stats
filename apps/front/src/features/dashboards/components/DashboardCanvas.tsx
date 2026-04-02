'use client'

import { Layout as LayoutIcon, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { removeWidgetFromDashboard, updateDashboardLayout } from '../store/dashboard-actions'
import { ensureDashboard, getDashboard } from '../store/dashboard-store'
import { snapToPresetForWidgetType } from '../widgets/unit-size-presets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import { WIDGET_CATALOG } from '../widgets/widgets-catalog'
import { DashboardHeader } from './DashboardHeader'

const AddWidgetModal = dynamic(
  () => import('@/components/dashboard/AddWidgetModal').then(mod => mod.AddWidgetModal),
  { ssr: false, loading: () => null },
)

type GridLayoutComponent = React.ComponentType<any> | null

function useContainerWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(1200)
  useEffect(() => {
    if (!el) return
    const read = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- debounced resize handler
      if (w > 0) setWidth(w)
    }
    read()
    const RO = (window as any).ResizeObserver as typeof ResizeObserver | undefined
    const ro = RO ? new RO(read) : null
    ro?.observe(el)
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('resize', read)
      ro?.disconnect()
    }
  }, [el])
  return { setEl, width }
}

// Clamp helper:
// - All widgets now respect their snapped preset size if available
// - Fallback to 6x3 if snapping fails or no type
const clampLayout = (items: any[], widgetsById: Map<string, any>) =>
  (items || []).map(n => {
    const widgetType = widgetsById.get(String(n.i))?.type as string | undefined
    if (widgetType) {
      const snapped = snapToPresetForWidgetType(widgetType, Number(n.w ?? 6), Number(n.h ?? 3))
      return {
        ...n,
        w: snapped.w,
        h: snapped.h,
        minW: snapped.w,
        maxW: snapped.w,
      }
    }
    return {
      ...n,
      h: 3,
      w: 6,
      minW: 6,
      maxW: 6,
    }
  })

export function DashboardCanvas(props: { dashboardId: string }) {
  const { t } = useTranslation()
  const [doc, setDoc] = useState(() =>
    props.dashboardId === 'draft' ? ensureDashboard('draft') : getDashboard(props.dashboardId),
  )
  const widgetsById = useMemo(
    () => new Map((doc?.widgets ?? []).map(w => [w.id, w])),
    [doc?.widgets],
  )
  const [layoutState, setLayoutState] = useState(() =>
    clampLayout((doc ?? ensureDashboard('draft')).layout, widgetsById),
  )
  const [GridLayout, setGridLayout] = useState<GridLayoutComponent>(null)
  const [resetKey, setResetKey] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { setEl: containerRef, width } = useContainerWidth()
  const saveTimerRef = useRef<any>(null)

  useEffect(() => {
    import('react-grid-layout').then((mod: any) => {
      setGridLayout(() => mod?.default || mod?.GridLayout)
    })
  }, [])

  useEffect(() => {
    const refresh = () => {
      if (props.dashboardId === 'draft') {
        const freshDoc = ensureDashboard('draft')
        setDoc(freshDoc)
        if (!saveTimerRef.current) {
          const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
          setLayoutState(clampLayout(freshDoc.layout, map))
        }
        return
      }
      const freshDoc = getDashboard(props.dashboardId)
      if (!freshDoc) return // do not recreate deleted dashboards
      setDoc(freshDoc)
      if (!saveTimerRef.current) {
        const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
        setLayoutState(clampLayout(freshDoc.layout, map))
      }
    }
    // eslint-disable-next-line react-web-api/no-leaked-event-listener -- cleanup in return
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => window.removeEventListener('coinflux_dashboards_updated', refresh as any)
  }, [props.dashboardId])

  const onLayoutChange = (next: any[]) => {
    const clamped = clampLayout(next, widgetsById)
    setLayoutState(clamped)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDashboardLayout(props.dashboardId, clamped)
      saveTimerRef.current = null
    }, 500)
  }

  const handleResetLayout = () => {
    if (!doc || !doc.widgets.length) return
    let currentX = 0
    let currentY = 0
    let currentRowHeight = 0

    const newLayout = doc.widgets.map(widget => {
      const existing = doc.layout?.find(l => String(l.i) === widget.id)
      let catalogItem = null
      for (const group of WIDGET_CATALOG) {
        const found = group.items.find(i => i.type === widget.type)
        if (found) {
          catalogItem = found
          break
        }
      }
      const d = catalogItem?.defaultLayout || { w: 6, h: 3 }
      const w0 = existing?.w ?? d.w
      const h0 = existing?.h ?? d.h
      // Use snapped preset for all widget types
      const snapped = snapToPresetForWidgetType(widget.type, w0, h0)
      const w = snapped.w
      const h = snapped.h

      // If widget width > 6 or current row can't fit, start new row
      if (w > 6 || currentX + w > 12) {
        currentY += currentRowHeight
        currentX = 0
        currentRowHeight = 0
      }

      const layoutItem = {
        i: widget.id,
        x: currentX,
        y: currentY,
        w,
        h,
        minW: w,
        maxW: w,
      }

      currentX += w
      currentRowHeight = Math.max(currentRowHeight, h)

      // If we've filled the row (x >= 12), start new row for next widget
      if (currentX >= 12) {
        currentY += currentRowHeight
        currentX = 0
        currentRowHeight = 0
      }

      return layoutItem
    })
    setLayoutState(clampLayout(newLayout, widgetsById))
    updateDashboardLayout(props.dashboardId, newLayout)
    setResetKey(prev => prev + 1)
  }

  if (!doc) return <div className="p-10 text-center text-white/30">{t('dashboard.notFound')}</div>
  if (!GridLayout)
    return <div className="p-10 text-center text-white/30">{t('common.loading')}</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <DashboardHeader dashboard={doc} onRefresh={() => setDoc(getDashboard(props.dashboardId)!)} />

      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="from-primary to-secondary shadow-primary/20 rounded bg-gradient-to-r px-4 py-2 text-sm font-medium text-white shadow-lg transition-all active:scale-95"
        >
          <Plus className="mr-1 inline h-4 w-4" />
          {t('dashboard.addWidget')}
        </button>
        <button
          type="button"
          onClick={handleResetLayout}
          className="rounded border border-[color:var(--cf-border)] px-4 py-2 text-sm text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
        >
          <LayoutIcon className="mr-1 inline h-4 w-4" />
          {t('dashboard.resetLayout')}
        </button>
      </div>

      <div ref={containerRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <GridLayout
          key={resetKey}
          layout={layoutState as any}
          cols={12}
          rowHeight={rowHeight}
          margin={[8, marginY]}
          width={width || 1200}
          onLayoutChange={onLayoutChange}
          isDraggable
          isResizable
          resizeHandles={['se']}
          draggableHandle=".react-draggable-handle"
          draggableCancel=".react-draggable-cancel"
        >
          {layoutState.map((l: any) => {
            const w = widgetsById.get(l.i)
            if (!w) return null
            return (
              <div
                key={l.i}
                className="group relative overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm transition-all duration-300"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <WidgetRenderer
                  widget={w}
                  onRemove={() => {
                    removeWidgetFromDashboard(props.dashboardId, w.id)
                    const freshDoc = getDashboard(props.dashboardId)
                    if (!freshDoc) return
                    setDoc(freshDoc)
                    const newMap = new Map((freshDoc.widgets ?? []).map(wd => [wd.id, wd]))
                    setLayoutState(clampLayout(freshDoc.layout, newMap))
                  }}
                />
              </div>
            )
          })}
        </GridLayout>
      </div>

      <AddWidgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dashboardId={props.dashboardId}
      />
    </div>
  )
}
