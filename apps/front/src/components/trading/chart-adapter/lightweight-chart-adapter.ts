import type { ChartAdapter, Unsubscribe } from '@/components/trading/chart-adapter/chart-adapter'

interface LightweightChartApi {
  priceScale?: (id: string) => unknown
  timeScale?: () => unknown
  subscribeCrosshairMove?: (cb: (param: unknown) => void) => void
  unsubscribeCrosshairMove?: (cb: (param: unknown) => void) => void
  subscribeClick?: (cb: (param: unknown) => void) => void
  unsubscribeClick?: (cb: (param: unknown) => void) => void
}

interface LightweightSeriesApi {
  priceToCoordinate?: (price: number) => number | null
  coordinateToPrice?: (y: number) => number | null
}

interface PriceScaleApi {
  priceToCoordinate?: (price: number) => number | null
  coordinateToPrice?: (y: number) => number | null
}

interface TimeScaleApi {
  subscribeVisibleTimeRangeChange?: (cb: () => void) => void
  unsubscribeVisibleTimeRangeChange?: (cb: () => void) => void
  subscribeVisibleLogicalRangeChange?: (cb: () => void) => void
  unsubscribeVisibleLogicalRangeChange?: (cb: () => void) => void
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function getPriceScale(chart: LightweightChartApi, id: string): PriceScaleApi | null {
  try {
    const ps = chart.priceScale?.(id)
    return isObject(ps) ? (ps as PriceScaleApi) : null
  } catch {
    return null
  }
}

function getTimeScale(chart: LightweightChartApi): TimeScaleApi | null {
  try {
    const ts = chart.timeScale?.()
    return isObject(ts) ? (ts as TimeScaleApi) : null
  } catch {
    return null
  }
}

/**
 * 确保 chart.priceScale(id) 暴露 priceToCoordinate / coordinateToPrice。
 * 若运行时缺失，则用 main series 的 coordinate API 做兜底注入（不改业务逻辑，满足 overlay 对齐硬约束）。
 */
function ensurePriceScaleCoordinateApi(chart: LightweightChartApi, series: LightweightSeriesApi, priceScaleId: string) {
  const fallback = {
    priceToCoordinate: (price: number) => {
      const y = series?.priceToCoordinate?.(price)
      return typeof y === 'number' && Number.isFinite(y) ? y : null
    },
    coordinateToPrice: (y: number) => {
      const p = series?.coordinateToPrice?.(y)
      return typeof p === 'number' && Number.isFinite(p) ? p : null
    },
  }

  try {
    // If chart.priceScale doesn't exist, create a minimal shim.
    if (typeof chart.priceScale !== 'function') {
      chart.priceScale = () => ({ ...fallback })
      return
    }

    // Try native first; if it has the APIs, do nothing.
    const native = getPriceScale(chart, priceScaleId)
    if (native && typeof native.priceToCoordinate === 'function' && typeof native.coordinateToPrice === 'function') return

    const original = chart.priceScale.bind(chart) as (id: string) => unknown
    chart.priceScale = (id: string) => {
      const scaleRaw = original(id)
      if (!isObject(scaleRaw)) return { ...fallback }
      const scale = scaleRaw as PriceScaleApi
      if (typeof scale.priceToCoordinate !== 'function') {
        scale.priceToCoordinate = fallback.priceToCoordinate
      }
      if (typeof scale.coordinateToPrice !== 'function') {
        scale.coordinateToPrice = fallback.coordinateToPrice
      }
      return scaleRaw
    }
  } catch {
    // last resort
    chart.priceScale = () => ({ ...fallback })
  }
}

export function createLightweightChartAdapter(args: {
  chart: LightweightChartApi
  mainSeries: LightweightSeriesApi
  priceScaleId?: string
  getCurrentPrice: () => number
}): ChartAdapter {
  const priceScaleId = args.priceScaleId ?? 'right'

  ensurePriceScaleCoordinateApi(args.chart, args.mainSeries, priceScaleId)

  return {
    getPriceToY: (price) => {
      const scale = getPriceScale(args.chart, priceScaleId)
      const y = scale?.priceToCoordinate?.(price)
      return typeof y === 'number' && Number.isFinite(y) ? y : null
    },

    getYToPrice: (y) => {
      const scale = getPriceScale(args.chart, priceScaleId)
      const p = scale?.coordinateToPrice?.(y)
      return typeof p === 'number' && Number.isFinite(p) ? p : null
    },

    subscribeChartChange: (cb) => {
      const ts = getTimeScale(args.chart)
      const unsubscribers: Unsubscribe[] = []

      if (ts?.subscribeVisibleTimeRangeChange && ts?.unsubscribeVisibleTimeRangeChange) {
        ts.subscribeVisibleTimeRangeChange(cb)
        unsubscribers.push(() => ts.unsubscribeVisibleTimeRangeChange?.(cb))
      }
      if (ts?.subscribeVisibleLogicalRangeChange && ts?.unsubscribeVisibleLogicalRangeChange) {
        ts.subscribeVisibleLogicalRangeChange(cb)
        unsubscribers.push(() => ts.unsubscribeVisibleLogicalRangeChange?.(cb))
      }

      return () => {
        for (const u of unsubscribers) u()
      }
    },

    subscribeCrosshairMove: (cb) => {
      args.chart.subscribeCrosshairMove?.(cb)
      return () => args.chart.unsubscribeCrosshairMove?.(cb)
    },

    subscribeClick: (cb) => {
      args.chart.subscribeClick?.(cb)
      return () => args.chart.unsubscribeClick?.(cb)
    },

    getCurrentPrice: args.getCurrentPrice,
  }
}


