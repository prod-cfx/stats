'use client'

import { Layout as LayoutIcon, Plus } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AddWidgetModal } from '@/components/dashboard/AddWidgetModal'
import { removeWidgetFromDashboard, updateDashboardLayout } from '../store/dashboardActions'
import { ensureDashboard, getDashboard } from '../store/dashboardStore'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import { WIDGET_CATALOG } from '../widgets/widgets.catalog'
import { DashboardHeader } from './DashboardHeader'

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

// Clamp helper: force h to exactly 3 (ultra-compact)
const clampLayout = (items: any[]) =>
  (items || []).map((n) => ({
    ...n,
    h: 3,
  }))

export function DashboardCanvas(props: { dashboardId: string }) {
  const [doc, setDoc] = useState(() => ensureDashboard(props.dashboardId))
  const [layoutState, setLayoutState] = useState(clampLayout(doc.layout))
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
      const freshDoc = getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId)
      setDoc(freshDoc)
      if (!saveTimerRef.current) setLayoutState(clampLayout(freshDoc.layout))
    }
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => window.removeEventListener('coinflux_dashboards_updated', refresh as any)
  }, [props.dashboardId])

  const widgetsById = useMemo(() => new Map(doc.widgets.map((w) => [w.id, w])), [doc.widgets])

  const onLayoutChange = (next: any[]) => {
    const clamped = clampLayout(next)
    setLayoutState(clamped)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDashboardLayout(props.dashboardId, clamped)
      saveTimerRef.current = null
    }, 500)
  }

  const handleResetLayout = () => {
    if (!doc.widgets.length) return
    const newLayout = doc.widgets.map((widget) => {
      let catalogItem = null
      for (const group of WIDGET_CATALOG) {
        const found = group.items.find((i) => i.type === widget.type)
        if (found) { catalogItem = found; break }
      }
      const d = catalogItem?.defaultLayout || { w: 6, h: 3 }
      return { i: widget.id, x: 0, y: 0, w: d.w, h: 3 }
    })
    setLayoutState(newLayout)
    updateDashboardLayout(props.dashboardId, newLayout)
    setResetKey(prev => prev + 1)
  }

  if (!GridLayout) return <div className="text-white/30 p-10 text-center">加载中...</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      <DashboardHeader dashboard={doc} onRefresh={() => setDoc(getDashboard(props.dashboardId)!)} />
      
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded text-sm font-medium">
          <Plus className="w-4 h-4 inline mr-1" />添加组件
        </button>
        <button type="button" onClick={handleResetLayout} className="border border-[#30363d] text-[#8b949e] px-4 py-2 rounded text-sm hover:text-white transition-colors">
          <LayoutIcon className="w-4 h-4 inline mr-1" />重置布局
        </button>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-y-auto no-scrollbar min-h-0">
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
            const calculatedPx = l.h * rowHeight + (l.h - 1) * marginY
            return (
              <div
                key={l.i}
                className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden shadow-sm relative group transition-all duration-300"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <div className="absolute top-0 right-0 z-50 bg-black/70 text-[#00ff00] text-[9px] px-1 pointer-events-none">
                  h:{l.h} | {calculatedPx}px
                </div>
                <WidgetRenderer 
                  widget={w} 
                  onRemove={() => {
                    removeWidgetFromDashboard(props.dashboardId, w.id)
                    const freshDoc = getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId)
                    setDoc(freshDoc)
                    setLayoutState(clampLayout(freshDoc.layout))
                  }} 
                />
              </div>
            )
          })}
        </GridLayout>
      </div>

      <AddWidgetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} dashboardId={props.dashboardId} />
    </div>
  )
}
