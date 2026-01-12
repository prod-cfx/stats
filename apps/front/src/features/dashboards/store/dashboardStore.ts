import type { WidgetType } from '../widgets/widgets.catalog'

export interface DashboardWidgetInstance {
  id: string
  type: WidgetType
  config: Record<string, any>
}

export interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardDoc {
  id: string
  name: string
  description?: string
  thumbnail?: string // URL or base64
  widgets: DashboardWidgetInstance[]
  layout: GridLayoutItem[]
  isPublished: boolean
  createdBy?: string
  createdAt: number
  updatedAt: number
}

const LS_KEY = 'coinflux_dashboards_v1'
const UPDATED_EVENT = 'coinflux_dashboards_updated'

function readAll(): Record<string, DashboardDoc> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, DashboardDoc>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY, JSON.stringify(data))
  // Same-tab notification (storage event does NOT fire in the same tab)
  try {
    window.dispatchEvent(new Event(UPDATED_EVENT))
  } catch {
    // ignore
  }
}

export function getDashboard(id: string): DashboardDoc | null {
  const all = readAll()
  return all[id] ?? null
}

export function getAllDashboards(): DashboardDoc[] {
  const all = readAll()
  // `draft` is an internal editor placeholder; it should not appear in any user-facing lists/counts.
  return Object.values(all)
    .filter((d) => d.id !== 'draft')
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getMyDashboards(): DashboardDoc[] {
  return getAllDashboards().filter((d) => d.isPublished)
}

export function getSavedDashboards(): DashboardDoc[] {
  return getAllDashboards().filter((d) => !d.isPublished)
}

export function upsertDashboard(doc: DashboardDoc) {
  const all = readAll()
  all[doc.id] = { ...doc, updatedAt: Date.now() }
  writeAll(all)
}

export function ensureDashboard(id: string, name = 'UNTITLED'): DashboardDoc {
  const existing = getDashboard(id)
  if (existing) return existing
  const now = Date.now()
  const doc: DashboardDoc = {
    id,
    name,
    widgets: [],
    layout: [],
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  }
  upsertDashboard(doc)
  return doc
}

export function updateDashboard(id: string, updater: (doc: DashboardDoc) => DashboardDoc) {
  const doc = ensureDashboard(id)
  upsertDashboard(updater(doc))
}

export function deleteDashboard(id: string) {
  const all = readAll()
  delete all[id]
  writeAll(all)
}

export function createNewDashboard(): DashboardDoc {
  const id = crypto.randomUUID()
  return ensureDashboard(id, 'UNTITLED')
}

export function publishDashboard(id: string) {
  updateDashboard(id, (doc) => ({ ...doc, isPublished: true }))
}

export function unpublishDashboard(id: string) {
  updateDashboard(id, (doc) => ({ ...doc, isPublished: false }))
}

export function updateDashboardMeta(
  id: string,
  updates: { name?: string; description?: string; thumbnail?: string },
) {
  updateDashboard(id, (doc) => ({ ...doc, ...updates }))
}

// Custom event name for listening to dashboard updates
export const DASHBOARD_UPDATED_EVENT = UPDATED_EVENT
