'use client'

import type { DashboardWidgetInstance, GridLayoutItem } from '../store/dashboard-store'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEventListener } from '@/hooks/useEventListener'
import { DASHBOARD_UPDATED_EVENT, ensureDashboard, getDashboard } from '../store/dashboard-store'
import { snapToPresetForWidgetType } from '../widgets/unit-size-presets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import {
  mobileWidgetMinHeight,
  sortLayoutForMobile,
  useDashboardMobileLayout,
} from './dashboard-layout-utils'

interface DashboardLayoutItem extends GridLayoutItem {
  minW?: number
  maxW?: number
}

interface GridLayoutProps {
  children: React.ReactNode
  cols: number
  compactType?: null
  isDraggable?: boolean
  isResizable?: boolean
  layout: DashboardLayoutItem[]
  margin?: [number, number]
  preventCollision?: boolean
  rowHeight: number
  width: number
}

type GridLayoutComponent = React.ComponentType<GridLayoutProps> | null

function useContainerWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(1200)
  const read = React.useCallback(() => {
    if (!el) return
    const w = Math.floor(el.getBoundingClientRect().width)
    if (w > 0) setWidth(w)
  }, [el])

  useEffect(() => {
    if (!el) return
    read()
    const RO = window.ResizeObserver
    const ro = RO ? new RO(read) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [el, read])
  useEventListener(typeof window === 'undefined' ? null : window, 'resize', read)

  return { setEl, width }
}

// Same clamp logic as editor canvas (read-only):
// - All widgets respect preset width/height
const clampLayout = (
  items: GridLayoutItem[] | undefined,
  widgetsById: Map<string, DashboardWidgetInstance>,
): DashboardLayoutItem[] =>
  (items || []).map(n => {
    const widgetType = widgetsById.get(String(n.i))?.type
    if (widgetType) {
      const snapped = snapToPresetForWidgetType(widgetType, Number(n.w ?? 6), Number(n.h ?? 3))
      return { ...n, w: snapped.w, h: snapped.h, minW: snapped.w, maxW: snapped.w }
    }
    return { ...n, h: 3, w: 6, minW: 6, maxW: 6 }
  })

export function DashboardReadOnlyCanvas(props: { dashboardId: string }) {
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
  const { setEl: containerRef, width } = useContainerWidth()
  const isMobileLayout = useDashboardMobileLayout()

  useEffect(() => {
    if (isMobileLayout) return
    import('react-grid-layout').then((mod: { default?: GridLayoutComponent, GridLayout?: GridLayoutComponent }) => {
      setGridLayout(() => mod.default || mod.GridLayout || null)
    })
  }, [isMobileLayout])

  const refreshDashboard = React.useCallback(() => {
    if (props.dashboardId === 'draft') {
      const freshDoc = ensureDashboard('draft')
      setDoc(freshDoc)
      const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
      setLayoutState(clampLayout(freshDoc.layout, map))
      return
    }
    const freshDoc = getDashboard(props.dashboardId)
    if (!freshDoc) return // do not recreate deleted dashboards
    setDoc(freshDoc)
    const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
    setLayoutState(clampLayout(freshDoc.layout, map))
  }, [props.dashboardId])

  useEffect(() => {
    refreshDashboard()
  }, [refreshDashboard])
  useEventListener(typeof window === 'undefined' ? null : window, DASHBOARD_UPDATED_EVENT, refreshDashboard)
  useEventListener(typeof window === 'undefined' ? null : window, 'storage', refreshDashboard)

  if (!doc) return <div className="p-10 text-center text-white/30">{t('dashboard.notFound')}</div>
  if (isMobileLayout) {
    return (
      <div
        data-testid="mobile-readonly-canvas"
        className="flex size-full min-w-0 flex-col gap-4 overflow-hidden"
      >
        {sortLayoutForMobile(layoutState).map((l) => {
          const w = widgetsById.get(l.i)
          if (!w) return null
          return (
            <div
              key={l.i}
              className="relative w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#161b22] shadow-sm"
              style={{ minHeight: mobileWidgetMinHeight(l) }}
            >
              <WidgetRenderer widget={w} draggable={false} />
            </div>
          )
        })}
      </div>
    )
  }
  if (!GridLayout)
    return <div className="p-10 text-center text-white/30">{t('common.loading')}</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="flex size-full flex-col overflow-hidden">
      <div ref={containerRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <GridLayout
          layout={layoutState}
          cols={12}
          rowHeight={rowHeight}
          margin={[8, marginY]}
          width={width || 1200}
          isDraggable={false}
          isResizable={false}
          preventCollision
          compactType={null}
        >
          {layoutState.map((l) => {
            const w = widgetsById.get(l.i)
            if (!w) return null
            return (
              <div
                key={l.i}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-[#161b22] shadow-sm transition-all duration-300"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <WidgetRenderer widget={w} draggable={false} />
              </div>
            )
          })}
        </GridLayout>
      </div>
    </div>
  )
}
