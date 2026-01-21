import type { ChartAdapter, Unsubscribe } from '@/components/trading/chart-adapter/chart-adapter'

type TvWidget = any

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function safeGetChart(widget: TvWidget): any | null {
  try {
    return widget?.activeChart?.() || widget?.chart?.() || null
  } catch {
    return null
  }
}

function safeGetMainPane(chart: any): any | null {
  try {
    const panes = chart?.getPanes?.()
    return Array.isArray(panes) && panes.length ? panes[0] : null
  } catch {
    return null
  }
}

function safeGetVisiblePriceRange(chart: any): { from: number; to: number } | null {
  try {
    const pane = safeGetMainPane(chart)
    const scale = pane?.getMainSourcePriceScale?.()
    const range = scale?.getVisiblePriceRange?.()
    if (!range || !isFiniteNumber(range.from) || !isFiniteNumber(range.to)) return null
    return { from: range.from, to: range.to }
  } catch {
    return null
  }
}

function safeGetPaneHeight(chart: any): number | null {
  try {
    const pane = safeGetMainPane(chart)
    const h = pane?.getHeight?.()
    return isFiniteNumber(h) && h > 0 ? h : null
  } catch {
    return null
  }
}

function safeGetMainScale(chart: any): any | null {
  try {
    const pane = safeGetMainPane(chart)
    return pane?.getMainSourcePriceScale?.() || null
  } catch {
    return null
  }
}

function safeGetPaneTopFromDom(containerEl: HTMLElement): number | null {
  try {
    const iframe = containerEl.querySelector('iframe') as HTMLIFrameElement | null
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return null
    const containerRect = containerEl.getBoundingClientRect()
    const iframeRect = iframe.getBoundingClientRect()
    // Heuristic: choose the largest visible canvas as main chart pane.
    const canvases = Array.from(doc.querySelectorAll('canvas')) as HTMLCanvasElement[]
    let bestTop: number | null = null
    let bestArea = 0
    for (const c of canvases) {
      const r = c.getBoundingClientRect()
      if (!r || r.width <= 0 || r.height <= 0) continue
      const area = r.width * r.height
      if (area <= bestArea) continue
      const top = r.top + iframeRect.top - containerRect.top
      if (!Number.isFinite(top)) continue
      bestArea = area
      bestTop = top
    }
    if (bestTop == null) return null
    if (bestTop < -10 || bestTop > containerEl.clientHeight + 10) return null
    return bestTop
  } catch {
    return null
  }
}

function safeIsScaleInverted(chart: any): boolean {
  try {
    const pane = safeGetMainPane(chart)
    const scale = pane?.getMainSourcePriceScale?.()
    return !!scale?.isInverted?.()
  } catch {
    return false
  }
}

/**
 * TradingView Charting Library adapter for "清算地图 overlay".
 *
 * Key constraint:
 * - Charting Library does not expose price<->pixel mapping directly (unlike lightweight-charts).
 * - We derive a stable affine mapping using:
 *   - visible price range (from/to)
 *   - main pane height
 *   - crosshair point.y + crosshair price (to back-calculate pane top offset)
 */
export function createTradingViewChartAdapter(args: {
  widget: TvWidget
  containerEl: HTMLElement
  getCurrentPrice: () => number
}): ChartAdapter {
  const state = {
    paneTop: null as number | null,
    paneHeight: null as number | null,
    range: null as { from: number; to: number } | null,
    inverted: false,
  }

  const refreshGeometry = () => {
    const chart = safeGetChart(args.widget)
    state.paneHeight = safeGetPaneHeight(chart)
    state.range = safeGetVisiblePriceRange(chart)
    state.inverted = safeIsScaleInverted(chart)
    if (state.paneTop == null) {
      const domTop = safeGetPaneTopFromDom(args.containerEl)
      if (typeof domTop === 'number' && Number.isFinite(domTop)) state.paneTop = domTop
    }
  }

  const updatePaneTopFromCrosshair = (params: any) => {
    try {
      const pt = params?.point
      const price = params?.price
      if (!pt || !isFiniteNumber(pt.y) || !isFiniteNumber(price)) return

      refreshGeometry()
      const h = state.paneHeight
      const r = state.range
      if (!h || !r) return
      const denom = r.to - r.from
      if (!isFiniteNumber(denom) || Math.abs(denom) < 1e-12) return

      // Standard (non-inverted): top is higher price. y grows downward.
      const t = state.inverted ? (price - r.from) / denom : (r.to - price) / denom
      const paneTop = pt.y - t * h
      if (isFiniteNumber(paneTop)) state.paneTop = paneTop

    } catch {
      // ignore
    }
  }

  const priceToY = (price: number): number | null => {
    refreshGeometry()
    const h = state.paneHeight
    const r = state.range
    // 📢 优化：如果还没通过十字线拿到精准 paneTop，先用一个合理的猜测值（如 header 约 38px）
    // 这样用户一点开指标就能立刻看到东西，而不是等鼠标移动才出来。
    const top = state.paneTop ?? 38 
    if (!h || !r) return null
    const denom = r.to - r.from
    if (!isFiniteNumber(denom) || Math.abs(denom) < 1e-12) return null

    const t = state.inverted ? (price - r.from) / denom : (r.to - price) / denom
    const y = top + t * h
    return isFiniteNumber(y) ? y : null
  }

  const yToPrice = (y: number): number | null => {
    refreshGeometry()
    const h = state.paneHeight
    const r = state.range
    // If we haven't learned paneTop from crosshair yet, use the same reasonable fallback
    // as priceToY so click-to-tooltip works immediately.
    const top = state.paneTop ?? 38
    if (!h || !r) return null
    const denom = r.to - r.from
    if (!isFiniteNumber(denom) || Math.abs(denom) < 1e-12) return null

    // 1) Prefer native coordinateToPrice if available (more accurate than affine mapping).
    let nativeAbs: number | null = null
    let nativeRel: number | null = null
    let nativePicked: number | null = null
    try {
      const chart = safeGetChart(args.widget)
      const scale = safeGetMainScale(chart)
      const c2p = scale?.coordinateToPrice
      if (typeof c2p === 'function') {
        const abs = c2p.call(scale, y)
        const rel = c2p.call(scale, y - top)
        nativeAbs = isFiniteNumber(abs) ? abs : null
        nativeRel = isFiniteNumber(rel) ? rel : null
        const inRange = (p: number | null) => (p != null ? p >= r.from - denom * 0.1 && p <= r.to + denom * 0.1 : false)
        // Choose the one that lands in the visible range; if both do, prefer the one closer to affine.
        // (This avoids guessing whether c2p expects absolute y or pane-relative y.)
        const tAffine = (y - top) / h
        const pAffine = state.inverted ? r.from + tAffine * denom : r.to - tAffine * denom
        if (inRange(nativeAbs) && !inRange(nativeRel)) nativePicked = nativeAbs
        else if (!inRange(nativeAbs) && inRange(nativeRel)) nativePicked = nativeRel
        else if (inRange(nativeAbs) && inRange(nativeRel)) {
          const da = Math.abs((nativeAbs as number) - pAffine)
          const dr = Math.abs((nativeRel as number) - pAffine)
          nativePicked = da <= dr ? nativeAbs : nativeRel
        }
      }
    } catch {
      // ignore
    }

    const t = (y - top) / h
    const p = state.inverted ? r.from + t * denom : r.to - t * denom
    if (nativePicked != null) return nativePicked
    return isFiniteNumber(p) ? p : null
  }

  const subscribeChartChange = (cb: () => void): Unsubscribe => {
    const chart = safeGetChart(args.widget)
    if (!chart) return () => {}

    const unsubs: Unsubscribe[] = []
    try {
      const sub = chart.onVisibleRangeChanged?.()
      if (sub?.subscribe && sub?.unsubscribe) {
        sub.subscribe(null, cb)
        unsubs.push(() => sub.unsubscribe(null, cb))
      }
    } catch {
      // ignore
    }
    try {
      const sub = chart.onDataLoaded?.()
      if (sub?.subscribe && sub?.unsubscribe) {
        sub.subscribe(null, cb)
        unsubs.push(() => sub.unsubscribe(null, cb))
      }
    } catch {
      // ignore
    }
    return () => {
      for (const u of unsubs) u()
    }
  }

  const subscribeCrosshairMove = (cb: (param: unknown) => void): Unsubscribe => {
    const chart = safeGetChart(args.widget)
    if (!chart) return () => {}

    const handler = (p: any) => {
      updatePaneTopFromCrosshair(p)
      cb(p)
    }
    try {
      const sub = chart.crossHairMoved?.()
      if (sub?.subscribe && sub?.unsubscribe) {
        sub.subscribe(null, handler)
        return () => sub.unsubscribe(null, handler)
      }
    } catch {
      // ignore
    }
    return () => {}
  }

  const subscribeClick = (cb: (param: unknown) => void): Unsubscribe => {
    const chart = safeGetChart(args.widget)

    // Prefer TradingView's own click subscription (works inside iframe).
    const tvHandler = (p: any) => {
      try {
        // Some builds provide point/price, some only provide point.
        // Reuse crosshair-based geometry update if possible.
        updatePaneTopFromCrosshair(p)
        cb(p)
      } catch {
        // ignore
      }
    }

    try {
      if (chart?.subscribeClick && chart?.unsubscribeClick) {
        chart.subscribeClick(tvHandler)
        return () => {
          try {
            chart.unsubscribeClick(tvHandler)
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    // Fallback 1: click inside TradingView iframe (this is the common case for Charting Library).
    try {
      const iframe = args.containerEl.querySelector('iframe') as HTMLIFrameElement | null
      const doc = iframe?.contentDocument
      if (iframe && doc) {
        const handler = (ev: MouseEvent) => {
          try {
            const containerRect = args.containerEl.getBoundingClientRect()
            const iframeRect = iframe.getBoundingClientRect()
            // In iframe document: clientX/Y are relative to the iframe viewport.
            // Convert to parent viewport, then to container coordinates.
            const x = ev.clientX + iframeRect.left - containerRect.left
            const y = ev.clientY + iframeRect.top - containerRect.top
            cb({ point: { x, y }, originalEvent: ev, _source: 'iframe' })
          } catch {
            // ignore
          }
        }

        // Use pointerdown only to avoid double-firing (pointerdown + mousedown) which would
        // immediately toggle the lock on/off in the liquidation-map click handler.
        doc.addEventListener('pointerdown', handler as any, true)
        return () => {
          try {
            doc.removeEventListener('pointerdown', handler as any, true)
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    // Fallback 2: outer container click (only works when click happens outside iframe).
    const domHandler = (ev: MouseEvent) => {
      try {
        const rect = args.containerEl.getBoundingClientRect()
        const x = ev.clientX - rect.left
        const y = ev.clientY - rect.top
        cb({ point: { x, y }, originalEvent: ev })
      } catch {
        // ignore
      }
    }
    args.containerEl.addEventListener('click', domHandler)
    return () => args.containerEl.removeEventListener('click', domHandler)
  }

  // Bootstrap geometry eagerly so first overlay draw has a chance (paneTop still needs crosshair once).
  refreshGeometry()

  return {
    getPriceToY: priceToY,
    getYToPrice: yToPrice,
    subscribeChartChange,
    subscribeCrosshairMove,
    subscribeClick,
    getCurrentPrice: args.getCurrentPrice,
  }
}

