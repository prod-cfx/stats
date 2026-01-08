import type { WidgetCatalogItem } from '../widgets/widgets.catalog'
import { snapToPreset } from '../widgets/unitSizePresets'
import { updateDashboard } from './dashboardStore'

export function addWidgetToDashboard(dashboardId: string, item: WidgetCatalogItem) {
  const id = crypto.randomUUID()
  updateDashboard(dashboardId, (doc) => {
    const widget = { id, type: item.type, config: item.defaultConfig }
    // Place new widgets at the top so users can see what they just added immediately.
    // react-grid-layout will resolve collisions via compaction.
    const snapped = snapToPreset(item.defaultLayout.w, item.defaultLayout.h)
    const layoutItem = { i: id, x: 0, y: 0, w: snapped.w, h: snapped.h }
    return { ...doc, widgets: [...doc.widgets, widget], layout: [...doc.layout, layoutItem], updatedAt: Date.now() }
  })
  return id
}

export function removeWidgetFromDashboard(dashboardId: string, widgetId: string) {
  updateDashboard(dashboardId, (doc) => ({
    ...doc,
    widgets: doc.widgets.filter((w) => w.id !== widgetId),
    layout: doc.layout.filter((l) => l.i !== widgetId),
    updatedAt: Date.now(),
  }))
}

export function updateDashboardLayout(dashboardId: string, layout: any[]) {
  updateDashboard(dashboardId, (doc) => {
    // Snap every layout item to the nearest preset (S/M/L/XL) to prevent height runaway.
    const normalized = (layout || []).map((l: any) => {
      const i = String(l.i)
      const x0 = Number.isFinite(l.x) ? Number(l.x) : 0
      const y0 = Number.isFinite(l.y) ? Number(l.y) : 0
      const w0 = Number.isFinite(l.w) ? Number(l.w) : 6
      const h0 = Number.isFinite(l.h) ? Number(l.h) : 8
      const snapped = snapToPreset(w0, h0)
      const x = Math.max(0, Math.min(12 - snapped.w, x0))
      const y = Math.max(0, y0)
      return { i, x, y, w: snapped.w, h: snapped.h }
    })
    return { ...doc, layout: normalized as any, updatedAt: Date.now() }
  })
}

