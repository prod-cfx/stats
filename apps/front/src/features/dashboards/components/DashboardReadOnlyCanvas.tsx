'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { DASHBOARD_UPDATED_EVENT, ensureDashboard, getDashboard } from '../store/dashboardStore'
import { snapToPresetForWidgetType } from '../widgets/unitSizePresets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'

type GridLayoutComponent = React.ComponentType<any> | null

function useContainerWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    if (!el) return
    const read = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
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

// Same clamp logic as editor canvas (read-only):
// - All widgets respect preset width/height
const clampLayout = (items: any[], widgetsById: Map<string, any>) =>
  (items || []).map((n) => {
    const widgetType = widgetsById.get(String(n.i))?.type as string | undefined
    if (widgetType) {
      const snapped = snapToPresetForWidgetType(widgetType, Number(n.w ?? 6), Number(n.h ?? 3))
      return { ...n, w: snapped.w, h: snapped.h, minW: snapped.w, maxW: snapped.w }
    }
    return { ...n, h: 3, w: 6, minW: 6, maxW: 6 }
  })

export function DashboardReadOnlyCanvas(props: { dashboardId: string }) {
  const [doc, setDoc] = useState(() =>
    props.dashboardId === 'draft' ? ensureDashboard('draft') : getDashboard(props.dashboardId),
  )
  const widgetsById = useMemo(() => new Map((doc?.widgets ?? []).map((w) => [w.id, w])), [doc?.widgets])
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
        setDoc(freshDoc)
        const map = new Map((freshDoc.widgets ?? []).map((w) => [w.id, w]))
        setLayoutState(clampLayout(freshDoc.layout, map))
        return
      }
      const freshDoc = getDashboard(props.dashboardId)
      if (!freshDoc) return // do not recreate deleted dashboards
      setDoc(freshDoc)
      const map = new Map((freshDoc.widgets ?? []).map((w) => [w.id, w]))
      setLayoutState(clampLayout(freshDoc.layout, map))
    }
    refresh()
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refresh as any)
      window.removeEventListener('storage', refresh)
    }
  }, [props.dashboardId])

  if (!doc) return <div className="text-white/30 p-10 text-center">看板不存在或已删除</div>
  if (!GridLayout) return <div className="text-white/30 p-10 text-center">加载中...</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      <div ref={containerRef} className="flex-1 relative overflow-y-auto no-scrollbar min-h-0">
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
                className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden shadow-sm relative transition-all duration-300"
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

