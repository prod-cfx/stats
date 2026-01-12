import type { WidgetCatalogItem } from '../widgets/widgets.catalog'
import { snapToPresetForWidgetType } from '../widgets/unitSizePresets'
import { updateDashboard } from './dashboardStore'

export function addWidgetToDashboard(dashboardId: string, item: WidgetCatalogItem) {
  const id = crypto.randomUUID()
  updateDashboard(dashboardId, (doc) => {
    const widget = { id, type: item.type, config: item.defaultConfig }
    const snapped = snapToPresetForWidgetType(item.type, item.defaultLayout.w, item.defaultLayout.h)
    
    // Smart placement: if width <= 6 and last row has space, place at x=6; else new row at x=0
    let x = 0
    let y = 0
    if (doc.layout.length > 0) {
      // Find the item with max y (bottom row)
      const maxY = Math.max(...doc.layout.map((l) => l.y))
      const bottomRow = doc.layout.filter((l) => l.y === maxY)
      const maxX = Math.max(...bottomRow.map((l) => l.x + l.w))
      
      if (snapped.w <= 6 && maxX <= 6) {
        // Place at x=6 on the same row
        x = 6
        y = maxY
      } else {
        // Start new row
        x = 0
        y = maxY + Math.max(...bottomRow.map((l) => l.h))
      }
    }
    
    const layoutItem = { i: id, x, y, w: snapped.w, h: snapped.h }
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
      const widgetType = doc.widgets.find((w) => w.id === i)?.type
      const snapped = snapToPresetForWidgetType(widgetType, w0, h0)
      const x = Math.max(0, Math.min(12 - snapped.w, x0))
      const y = Math.max(0, y0)
      return { i, x, y, w: snapped.w, h: snapped.h }
    })
    return { ...doc, layout: normalized as any, updatedAt: Date.now() }
  })
}

