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

// Clamp helper: force ultra-compact size and default two-column width (6/12 cols)
const clampLayout = (items: any[]) =>
  (items || []).map((n) => ({
    ...n,
    h: 3,
    w: 6,
    minW: 6,
    maxW: 6,
  }))

export function DashboardCanvas(props: { dashboardId: string }) {
  const [doc, setDoc] = useState(() =>
    props.dashboardId === 'draft' ? ensureDashboard('draft') : getDashboard(props.dashboardId),
  )
  const [layoutState, setLayoutState] = useState(() => clampLayout((doc ?? ensureDashboard('draft')).layout))
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
        if (!saveTimerRef.current) setLayoutState(clampLayout(freshDoc.layout))
        return
      }
      const freshDoc = getDashboard(props.dashboardId)
      if (!freshDoc) return // do not recreate deleted dashboards
      setDoc(freshDoc)
      if (!saveTimerRef.current) setLayoutState(clampLayout(freshDoc.layout))
    }
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => window.removeEventListener('coinflux_dashboards_updated', refresh as any)
  }, [props.dashboardId])

  const widgetsById = useMemo(() => new Map((doc?.widgets ?? []).map((w) => [w.id, w])), [doc?.widgets])

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
    let currentX = 0
    let currentY = 0
    let currentRowHeight = 0
    
    const newLayout = doc.widgets.map((widget) => {
      let catalogItem = null
      for (const group of WIDGET_CATALOG) {
        const found = group.items.find((i) => i.type === widget.type)
        if (found) { catalogItem = found; break }
      }
      const d = catalogItem?.defaultLayout || { w: 6, h: 3 }
      const w = d.w
      const h = d.h
      
      // If widget width > 6 or current row can't fit, start new row
      if (w > 6 || currentX + w > 12) {
        currentY += currentRowHeight
        currentX = 0
        currentRowHeight = 0
      }
      
      const layoutItem = { i: widget.id, x: currentX, y: currentY, w, h, minW: 6, maxW: 12 }
      
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
    setLayoutState(newLayout)
    updateDashboardLayout(props.dashboardId, newLayout)
    setResetKey(prev => prev + 1)
  }

  if (!doc) return <div className="text-white/30 p-10 text-center">看板不存在或已删除</div>
  if (!GridLayout) return <div className="text-white/30 p-10 text-center">加载中...</div>

  const rowHeight = 10
  const marginY = 6

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      <DashboardHeader dashboard={doc} onRefresh={() => setDoc(getDashboard(props.dashboardId)!)} />
      
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-2 rounded text-sm font-medium shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
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
            return (
              <div
                key={l.i}
                className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden shadow-sm relative group transition-all duration-300"
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <WidgetRenderer 
                  widget={w} 
                  onRemove={() => {
                    removeWidgetFromDashboard(props.dashboardId, w.id)
                  const freshDoc = getDashboard(props.dashboardId)
                  if (!freshDoc) return
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
