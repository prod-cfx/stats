'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_UPDATED_EVENT, ensureDashboard, getDashboard } from '../store/dashboard-store'
import { snapToPresetForWidgetType } from '../widgets/unit-size-presets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'

type GridLayoutComponent = React.ComponentType<any> | null

function useContainerWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    if (!el) return
    const read = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
      if (w > 0) {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync container width
        setWidth(w)
      }
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

// Same clamp logic as editor canvas (read-only):
// - All widgets respect preset width/height
const clampLayout = (items: any[], widgetsById: Map<string, any>) =>
  (items || []).map(n => {
    const widgetType = widgetsById.get(String(n.i))?.type as string | undefined
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

  useEffect(() => {
    import('react-grid-layout').then((mod: any) => {
      setGridLayout(() => mod?.default || mod?.GridLayout)
    })
  }, [])

  useEffect(() => {
    const refresh = () => {
      if (props.dashboardId === 'draft') {
        const freshDoc = ensureDashboard('draft')
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync draft dashboard
        setDoc(freshDoc)
        const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync layout from storage
        setLayoutState(clampLayout(freshDoc.layout, map))
        return
      }
      const freshDoc = getDashboard(props.dashboardId)
      if (!freshDoc) return // do not recreate deleted dashboards
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync stored dashboard
      setDoc(freshDoc)
      const map = new Map((freshDoc.widgets ?? []).map(w => [w.id, w]))
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- sync layout from storage
      setLayoutState(clampLayout(freshDoc.layout, map))
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [props.dashboardId])

  if (!doc) return <div className="p-10 text-center text-white/30">{t('dashboard.notFound')}</div>
  if (!GridLayout)
    return <div className="p-10 text-center text-white/30">{t('common.loading')}</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div ref={containerRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <GridLayout
          layout={layoutState as any}
          cols={12}
          rowHeight={rowHeight}
          margin={[8, marginY]}
          width={width || 1200}
          isDraggable={false}
          isResizable={false}
          preventCollision
          compactType={null}
        >
          {layoutState.map((l: any) => {
            const w = widgetsById.get(l.i)
            if (!w) return null
            return (
              <div
                key={l.i}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-[#161b22] shadow-sm transition-all duration-300"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <WidgetRenderer widget={w} />
              </div>
            )
          })}
        </GridLayout>
      </div>
    </div>
  )
}
