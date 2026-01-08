'use client'

import { Plus } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AddWidgetModal } from '@/components/dashboard/AddWidgetModal'
import { removeWidgetFromDashboard, updateDashboardLayout } from '../store/dashboardActions'
import { ensureDashboard, getDashboard } from '../store/dashboardStore'
import { snapToPreset } from '../widgets/unitSizePresets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import { DashboardHeader } from './DashboardHeader'

type GridLayoutComponent = React.ComponentType<any> | null

function useContainerWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!el) return

    const read = () => setWidth(Math.floor(el.getBoundingClientRect().width))

    // Initial read + a few RAF retries (covers cases where layout isn't settled yet)
    read()
    let raf = 0
    let tries = 0
    const tick = () => {
      tries += 1
      read()
      if (tries < 10 && el.getBoundingClientRect().width === 0) {
        raf = window.requestAnimationFrame(tick)
      }
    }
    raf = window.requestAnimationFrame(tick)

    // Prefer ResizeObserver when available
    const RO = (window as any).ResizeObserver as typeof ResizeObserver | undefined
    const ro = RO
      ? new RO(() => {
          read()
        })
      : null
    ro?.observe(el)

    // Fallback: window resize listener
    window.addEventListener('resize', read)

    return () => {
      window.removeEventListener('resize', read)
      if (raf) window.cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [el])

  return { setEl, width }
}

export function DashboardCanvas(props: { dashboardId: string }) {
  const [doc, setDoc] = useState(() => ensureDashboard(props.dashboardId))
  const [GridLayout, setGridLayout] = useState<GridLayoutComponent>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { setEl: containerRef, width } = useContainerWidth()
  const saveTimerRef = useRef<any>(null)

  useEffect(() => {
    // react-grid-layout currently doesn't export WidthProvider in this repo setup.
    // Load the component dynamically and provide width via ResizeObserver.
    let cancelled = false
    import('react-grid-layout')
      .then((mod: any) => {
        const Comp = mod?.ReactGridLayout ?? mod?.GridLayout ?? mod?.default
        if (!cancelled && typeof Comp === 'function') setGridLayout(() => Comp)
      })
      .catch(() => {
        // ignore, fallback will render
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 监听 localStorage 变化（简单刷新机制）
  useEffect(() => {
    const refresh = () => setDoc(getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('coinflux_dashboards_updated', refresh as any)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('coinflux_dashboards_updated', refresh as any)
    }
  }, [props.dashboardId])

  // One-time normalization: if any existing widget has runaway size, snap it back to presets.
  useEffect(() => {
    if (!doc?.layout?.length) return
    const normalized = doc.layout.map((l) => {
      const snapped = snapToPreset(l.w, l.h)
      const x = Math.max(0, Math.min(12 - snapped.w, l.x))
      const y = Math.max(0, l.y)
      return { ...l, x, y, w: snapped.w, h: snapped.h }
    })
    const changed =
      normalized.length !== doc.layout.length ||
      normalized.some((n, idx) => {
        const o = doc.layout[idx]
        return !o || n.w !== o.w || n.h !== o.h || n.x !== o.x || n.y !== o.y
      })
    if (changed) {
      updateDashboardLayout(props.dashboardId, normalized as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dashboardId])

  const layout = useMemo(() => doc.layout, [doc.layout])
  const widgetsById = useMemo(() => new Map(doc.widgets.map((w) => [w.id, w])), [doc.widgets])

  const onLayoutChange = (next: any[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDashboardLayout(props.dashboardId, next)
      setDoc(getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId))
    }, 250)
  }

  const handleRefresh = () => {
    setDoc(getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId))
  }

  if (!GridLayout) {
    return <div className="text-white/50 text-sm">Loading grid...</div>
  }

  // Wait until we have a real width so GridLayout can compute pixel sizes.
  if (!width) {
    return (
      <div ref={containerRef} className="w-full min-h-[200px] text-white/50 text-sm">
        Loading canvas...
      </div>
    )
  }

  return (
    <div className="w-full">
      <DashboardHeader dashboard={doc} onRefresh={handleRefresh} />

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          添加组件
        </button>

        <button
          onClick={() => {
            // Reset layout logic (if needed)
          }}
          className="px-4 py-2 border border-[#30363d] text-[#8b949e] hover:text-white hover:border-white/20 rounded-lg transition-colors text-sm"
        >
          Reset Layout
        </button>
      </div>

      <div ref={containerRef} className="w-full relative">
        <GridLayout
          className="layout"
          layout={layout as any}
          width={width}
          cols={12}
          rowHeight={24}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          compactType="vertical"
          preventCollision={false}
          onLayoutChange={onLayoutChange}
          draggableHandle=".react-draggable-handle"
        >
          {layout.map((l) => {
            const w = widgetsById.get(l.i)
            if (!w) return null
            return (
              <div key={l.i} className="react-draggable-handle">
                <WidgetRenderer
                  widget={w}
                  onRemove={() => {
                    removeWidgetFromDashboard(props.dashboardId, w.id)
                    setDoc(getDashboard(props.dashboardId) ?? ensureDashboard(props.dashboardId))
                  }}
                />
              </div>
            )
          })}
        </GridLayout>

        {/* Empty State */}
        {doc.widgets.length === 0 ? (
          <div className="mt-20 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center">
              <Plus className="w-10 h-10 text-[#8b949e]" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2">空看板</h3>
            <p className="text-[#8b949e] text-sm mb-4">点击上方"添加组件"按钮开始构建你的数据看板</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
            >
              添加第一个组件
            </button>
          </div>
        ) : null}

        {/* Grid Plus Buttons (positioned on grid) */}
        {doc.widgets.length > 0 && (
          <div className="absolute top-4 right-4 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={`add-btn-${i}`}
                onClick={() => setIsModalOpen(true)}
                className="w-8 h-8 rounded-lg bg-[#21262d] border border-[#30363d] hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-all group"
                title="添加组件"
              >
                <Plus className="w-4 h-4 text-[#8b949e] group-hover:text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      <AddWidgetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} dashboardId={props.dashboardId} />
    </div>
  )
}
