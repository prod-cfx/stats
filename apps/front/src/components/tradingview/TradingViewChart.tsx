'use client'

import type { MutableRefObject, Ref } from 'react'
import type { LiquidationMapChartHandle } from '@/components/liquidation-map/LiquidationMapChart'
import type { ChartAdapter } from '@/components/trading/chart-adapter/chart-adapter'
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { createTradingViewChartAdapter } from '@/components/trading/chart-adapter/tradingview-chart-adapter'
import { fetchAggregatedOpenInterest, fetchLongShortRatio } from '@/lib/api'
import { generateLiquidationMapMockData, liquidationSymbolPrices } from '@/lib/liquidation-map/mock-liquidation-map'
import { logger } from '@/utils/logger'
import { mockDatafeed } from './mockDatafeed'

// 日志控制：仅在开发环境或显式启用时输出调试日志
const isDevelopment = process.env.NODE_ENV === 'development'
const enableOIDebugLogs = isDevelopment || process.env.NEXT_PUBLIC_ENABLE_OI_DEBUG === 'true'

// 持仓量数据日志辅助函数
const oiLogger = {
  debug: (...args: any[]) => {
    if (enableOIDebugLogs) {
      console.log('[OI]', ...args)
    }
  },
  warn: (...args: any[]) => {
    if (enableOIDebugLogs) {
      console.warn('[OI]', ...args)
    }
  },
  error: (...args: any[]) => {
    // 错误日志始终输出
    console.error('[OI]', ...args)
  },
}

// Constants for long-short ratio data fetching
const LONG_SHORT_RATIO_FETCH_LIMIT = 500
const LONG_SHORT_RATIO_REFRESH_INTERVAL_MS = 30000
const LONG_SHORT_RATIO_MAX_TIME_DIFF_MS = 3600000

declare global {
  interface Window {
    TradingView?: any
  }
}

type TradingViewWidget = any

const SCRIPT_SRC = '/tradingview/charting_library/charting_library.js'
const LIBRARY_PATH = '/tradingview/charting_library/'
const SCRIPT_ID = 'tv-charting-library-script'
const PENDING_STUDY_ID = '__pending__'

function resolveMaybePromiseId(maybe: any, onResolved: (id: string) => void) {
  if (!maybe) return
  if (typeof maybe?.then === 'function') {
    void (maybe as Promise<any>)
      .then((id) => {
        if (id) onResolved(String(id))
      })
      .catch(() => {
        // ignore
      })
    return
  }
  onResolved(String(maybe))
}

function findAndDedupeStudyByName(chart: any, studyName: string): string | null {
  try {
    const studies = chart?.getAllStudies?.() as Array<{ id: any; name: string }> | undefined
    if (!Array.isArray(studies) || studies.length === 0) return null
    const matches = studies.filter((s) => s?.name === studyName)
    if (matches.length === 0) return null
    const keep = matches[0]
    // Remove duplicates beyond the first one.
    for (let i = 1; i < matches.length; i++) {
      const s = matches[i]
      try {
        chart?.removeEntity?.(s.id)
      } catch {
        // ignore
      }
    }
    return keep?.id ? String(keep.id) : null
  } catch {
    return null
  }
}

function loadTradingViewScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  // 已经加载过
  if (window.TradingView?.widget) return Promise.resolve()

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${SCRIPT_SRC}`)), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${SCRIPT_SRC}`))
    document.head.appendChild(script)
  })
}

export interface TradingViewChartProps {
  symbol?: string
  /**
   * TradingView resolution:
   * - '1','5','15','60','240','1D'
   */
  interval?: string
  /**
   * 跟随站点主题（TradingView Charting Library 期望值：'Dark' | 'Light'）
   */
  theme?: 'Dark' | 'Light'

  /**
   * 在 TradingView header 注入自定义按钮，触发页面原有逻辑（聚合/指标/精选指标）
   */
  isAggregated?: boolean
  selectedExchange?: 'binance' | 'okx'
  onSelectExchange?: (exchange: 'binance' | 'okx') => void
  onToggleAggregate?: () => void
  onOpenIndicator?: () => void
  onOpenDataIndicator?: () => void
  onIntervalChanged?: (interval: string) => void

  /** CenterChartPanel 传入：用于 chartOverlay（例如：清算地图） */
  activeIndicators?: Array<{
    id: string
    label: string
    kind: 'chartSeries' | 'chartOverlay'
    href?: string
  }>
  onRemoveIndicator?: (id: string) => void
}

export interface TradingViewChartRef {
  addStudy: (studyName: string) => void
  ensureCustomIndicator: (id: 'long-short-ratio' | 'aggregated-open-interest' | 'aggregated-volume' | 'liquidation-data') => void
  removeCustomIndicator: (id: 'long-short-ratio' | 'aggregated-open-interest' | 'aggregated-volume' | 'liquidation-data') => void
  removeAllStudies: () => void
}

type CustomIndicatorId = 'long-short-ratio' | 'aggregated-open-interest' | 'aggregated-volume' | 'liquidation-data'

// IMPORTANT:
// - study name 必须稳定（不能随语言变化），否则 createStudy(name) 会找不到对应的指标 -> “聚合多空比不显示”
// - 可翻译的内容放在 metainfo.shortDescription / plot title 里即可
const CUSTOM_STUDY_NAME_BY_ID: Record<CustomIndicatorId, string> = {
  'long-short-ratio': 'Coinflux: Long/Short Ratio',
  'aggregated-open-interest': 'Coinflux: Aggregated Open Interest',
  'aggregated-volume': 'Coinflux: Aggregated Volume',
  'liquidation-data': 'Coinflux: Liquidation Data',
}

const LIQ_MAP_DRAWING_LABEL = 'Coinflux: Liquidation Map'
// Legend 需要一个 study 条目才会显示 eye / X 按钮；drawings 不会出现在指标 legend。
// 这里用一个“占位 study”（visible=false，不绘制）来提供原生 legend 操作入口。
const LIQ_MAP_STUDY_NAME = 'Coinflux: Liquidation Map'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function parsePriceLabel(label: string): number | null {
  const n = Number.parseFloat(String(label).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function interpolateByPrice(xs: number[], ys: number[], x: number): number {
  // xs must be sorted ascending.
  if (!xs.length) return 0
  if (x <= xs[0]) return ys[0] ?? 0
  const last = xs.length - 1
  if (x >= xs[last]) return ys[last] ?? 0

  // binary search
  let lo = 0
  let hi = last
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  const x0 = xs[lo]
  const x1 = xs[lo + 1]
  const y0 = ys[lo] ?? 0
  const y1 = ys[lo + 1] ?? 0
  if (x1 === x0) return y0
  const t = (x - x0) / (x1 - x0)
  return lerp(y0, y1, clamp(t, 0, 1))
}

function formatUsdCompactFromMillions(valueM: number): string {
  const v = typeof valueM === 'number' && Number.isFinite(valueM) ? valueM : 0
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}B`
  return `$${Math.round(v)}M`
}

function parseResolutionToMs(resolution?: string): number {
  if (!resolution) return 0
  const match = resolution.match(/^(\d+)([a-z]?)$/i)
  if (!match) return 0
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return 0
  const unit = match[2]?.toUpperCase() ?? ''
  switch (unit) {
    case '':
      return value * 60 * 1000
    case 'H':
      return value * 60 * 60 * 1000
    case 'D':
      return value * 24 * 60 * 60 * 1000
    case 'W':
      return value * 7 * 24 * 60 * 60 * 1000
    case 'M':
      return value * 30 * 24 * 60 * 60 * 1000
    default:
      return 0
  }
}

const LONG_SHORT_RATIO_SUPPORTED_INTERVALS = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '1w',
])

const LONG_SHORT_RATIO_INTERVAL_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  '360': '6h',
  '480': '8h',
  '720': '12h',
  '1d': '1d',
  '1w': '1w',
  '1D': '1d',
  '1W': '1w',
}

function resolveLongShortRatioInterval(interval: string): string | null {
  const raw = interval.trim()
  const mapped = LONG_SHORT_RATIO_INTERVAL_MAP[raw] ?? LONG_SHORT_RATIO_INTERVAL_MAP[raw.toLowerCase()] ?? raw
  const normalized = mapped.toLowerCase()
  if (!LONG_SHORT_RATIO_SUPPORTED_INTERVALS.has(normalized)) return null
  return normalized
}

function useLongShortRatioData(pairSymbol: string, tvInterval: string) {
  const dataRef = useRef<Map<number, number>>(new Map())
  // Sorted timestamps for binary search
  const sortedTimestampsRef = useRef<number[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const apiInterval = resolveLongShortRatioInterval(tvInterval)

      if (!apiInterval) {
        dataRef.current.clear()
        sortedTimestampsRef.current = []
        return
      }

      const normalizedSymbol = pairSymbol.toUpperCase().endsWith('USDT')
        ? pairSymbol.toUpperCase()
        : `${pairSymbol.toUpperCase()}USDT`
      const tradingPairId = `${normalizedSymbol}.BINANCE.PERP`

      const data = await fetchLongShortRatio({
        tradingPairId,
        interval: apiInterval,
        limit: LONG_SHORT_RATIO_FETCH_LIMIT,
      })

      const map = new Map<number, number>()
      const timestamps: number[] = []
      data.forEach((item) => {
        const ts = new Date(item.timestamp).getTime()
        const ratio = Number.parseFloat(item.longShortRatio)
        if (!Number.isNaN(ratio)) {
          map.set(ts, ratio)
          timestamps.push(ts)
        }
      })

      // Sort timestamps for binary search
      timestamps.sort((a, b) => a - b)
      dataRef.current = map
      sortedTimestampsRef.current = timestamps
    } catch (error) {
      logger.error('[useLongShortRatioData] Failed to fetch long-short ratio data', error)
      dataRef.current.clear()
      sortedTimestampsRef.current = []
    }
  }, [pairSymbol, tvInterval])

  useEffect(() => {
    void fetchData()
    timerRef.current = setInterval(() => {
      void fetchData()
    }, LONG_SHORT_RATIO_REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchData])

  return { dataRef, sortedTimestampsRef }
}

function createCustomIndicatorsGetter(opts?: {
  theme?: 'Dark' | 'Light'
  t: (key: string) => string
  lsDataRef?: MutableRefObject<Map<number, number>>
  lsSortedTimestampsRef?: MutableRefObject<number[]>
  openInterestDataRef?: MutableRefObject<{
    timestamps: number[]
    values: number[]
  }>
  interval?: string
}) {
  // Charting Library custom studies: register indicator definitions at widget init time.
  return function custom_indicators_getter(PineJS: any) {
    const theme = opts?.theme ?? 'Light'
    const tFunc = opts?.t ?? ((k: string) => k)
    const oiDataRef = opts?.openInterestDataRef
    const intervalMs = parseResolutionToMs(opts?.interval)
    const names = CUSTOM_STUDY_NAME_BY_ID
    const lsDataRef = opts?.lsDataRef
    const lsSortedTimestampsRef = opts?.lsSortedTimestampsRef
    type LongShortRatioIndicatorContext = {
      _context?: unknown
      _input?: unknown
      _dataRef?: MutableRefObject<Map<number, number>>
      _sortedTimestampsRef?: MutableRefObject<number[]>
      _prev?: number | null
      init?: (context: unknown, inputCallback: unknown) => void
      main?: (context: unknown) => [number, number]
    }
    const mkBaseMeta = (id: string, name: string, shortDescription: string, plots: any[], defaults: any, styles: any, format: any) => ({
      _metainfoVersion: 51,
      id,
      scriptIdPart: '',
      name,
      description: name,
      shortDescription,
      is_custom_indicator: true,
      is_hidden_study: false,
      is_price_study: false,
      plots,
      defaults,
      styles,
      inputs: [],
      format,
    })

    function findClosestValue(
      timestamps: number[],
      values: number[],
      target: number,
      tolerance: number,
    ): number | null {
      if (!timestamps.length) return null

      let left = 0
      let right = timestamps.length - 1

      while (left < right) {
        const mid = Math.floor((left + right) / 2)
        if (timestamps[mid] < target) {
          left = mid + 1
        } else {
          right = mid
        }
      }

      let closestIdx = left
      if (left > 0) {
        const diffLeft = Math.abs(timestamps[left] - target)
        const diffPrev = Math.abs(timestamps[left - 1] - target)
        if (diffPrev < diffLeft) {
          closestIdx = left - 1
        }
      }

      const diff = Math.abs(timestamps[closestIdx] - target)
      if (diff <= tolerance) {
        const value = values[closestIdx]
        return typeof value === 'number' ? value : null
      }

      return null
    }

    const IND_LS = {
      name: names['long-short-ratio'],
      metainfo: {
        _metainfoVersion: 51,
        id: 'Coinflux_LS@tv-basicstudies-1',
        scriptIdPart: '',
        name: names['long-short-ratio'],
        description: names['long-short-ratio'],
        shortDescription: tFunc('chart.indicators.longShortRatio'),
        is_custom_indicator: true,
        is_hidden_study: false,
        is_price_study: false,
        // ✅ 对齐“之前效果”：单条连续线 + palette colorer 按点变色（红/绿分段）
        plots: [
          { id: 'plot_0', type: 'line' },
          { id: 'plot_1', type: 'colorer', palette: 'palette_0', target: 'plot_0' },
        ],
        palettes: {
          palette_0: {
            colors: {
              0: { color: '#22c55e', width: 1, style: 0 },
              1: { color: '#ef4444', width: 1, style: 0 },
            },
          },
        },
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 2, plottype: 'line', trackPrice: false, transparency: 0, visible: true, color: '#22c55e' },
          },
          palettes: {
            palette_0: {
              colors: {
                0: { color: '#22c55e', width: 1, style: 0 },
                1: { color: '#ef4444', width: 1, style: 0 },
              },
            },
          },
          inputs: {},
        },
        styles: {
          plot_0: { title: tFunc('chart.indicators.longShortRatio'), histogramBase: 0, joinPoints: true, zorder: 1 },
        },
        inputs: [],
        format: { type: 'price', precision: 4 },
      },
      // IMPORTANT: Charting Library will do `new indicator.constructor()`
      // Object method shorthand `constructor () {}` is NOT constructible in JS.
      constructor: function (this: LongShortRatioIndicatorContext) {
        this.init = function (context: unknown, inputCallback: unknown) {
          this._context = context
          this._input = inputCallback
          this._dataRef = lsDataRef
          this._sortedTimestampsRef = lsSortedTimestampsRef
          this._prev = null
        }
        this.main = function (context: unknown) {
          this._context = context
          const time = PineJS.Std.time(context)
          const dataMap: Map<number, number> | undefined = this._dataRef?.current
          const sortedTimestamps: number[] | undefined = this._sortedTimestampsRef?.current

          if (!dataMap || dataMap.size === 0 || !sortedTimestamps || sortedTimestamps.length === 0) {
            return [Number.NaN, 0]
          }

          // Binary search to find the closest timestamp
          let left = 0
          let right = sortedTimestamps.length - 1
          let closestIdx = 0

          while (left <= right) {
            const mid = Math.floor((left + right) / 2)
            const midTs = sortedTimestamps[mid]
            if (midTs === time) {
              closestIdx = mid
              break
            } else if (midTs < time) {
              left = mid + 1
            } else {
              right = mid - 1
            }
            // Track closest so far
            if (Math.abs(sortedTimestamps[closestIdx] - time) > Math.abs(midTs - time)) {
              closestIdx = mid
            }
          }

          // Check neighbors for the actual closest
          const candidates = [closestIdx]
          if (closestIdx > 0) candidates.push(closestIdx - 1)
          if (closestIdx < sortedTimestamps.length - 1) candidates.push(closestIdx + 1)

          let bestTs = sortedTimestamps[closestIdx]
          let minDiff = Math.abs(bestTs - time)
          for (const idx of candidates) {
            const ts = sortedTimestamps[idx]
            const diff = Math.abs(ts - time)
            if (diff < minDiff) {
              minDiff = diff
              bestTs = ts
            }
          }

          if (minDiff > LONG_SHORT_RATIO_MAX_TIME_DIFF_MS) {
            return [Number.NaN, 0]
          }

          const ratio = dataMap.get(bestTs)
          if (ratio == null) {
            return [Number.NaN, 0]
          }

          const isGreen = ratio >= 1.0
          this._prev = ratio

          return [ratio, isGreen ? 0 : 1]
        }
      },
    }

    const oiGradientBottom = theme === 'Dark' ? '#0b1220' : '#ffffff'

    const IND_OI = {
      name: names['aggregated-open-interest'],
      metainfo: {
        _metainfoVersion: 51,
        id: 'Coinflux_OI@tv-basicstudies-1',
        scriptIdPart: '',
        name: names['aggregated-open-interest'],
        description: names['aggregated-open-interest'],
        shortDescription: tFunc('chart.indicators.aggregatedOpenInterest'),
        is_custom_indicator: true,
        is_hidden_study: false,
        is_price_study: false,
        // 关键：用 baseline + filledAreas 做 “面积填充”，效果与截图一致
        plots: [
          { id: 'plot_0', type: 'line' },
          { id: 'plot_baseline', type: 'line' },
        ],
        filledAreasStyle: {
          // 渐变阴影：从线附近颜色更实，到面板底部更透明
          // 参考 Charting Library: StudyFilledAreaGradientColorStyle
          // - fillType: "gradient"
          // - 渐变两端颜色优先写在 filledAreas(StudyFilledAreaInfo) 的 topColor/bottomColor
          // - transparency: 总体透明度（0=不透明，100=全透明）
          fill_0: {
            fillType: 'gradient',
            transparency: 55,
            visible: true,
          },
          // 兜底：如果某些版本/配置不渲染 gradient，至少有一层淡淡的阴影
          fill_1: {
            color: '#22d3ee',
            transparency: 88,
            visible: true,
          },
        },
        filledAreas: [
          {
            id: 'fill_0',
            objAId: 'plot_0',
            objBId: 'plot_baseline',
            type: 'plot_plot',
            title: 'Fill',
            zorder: -1,
            fillgaps: true,
            topColor: '#22d3ee',
            bottomColor: oiGradientBottom,
          },
          {
            id: 'fill_1',
            objAId: 'plot_0',
            objBId: 'plot_baseline',
            type: 'plot_plot',
            title: 'Fill (fallback)',
            zorder: -2,
            fillgaps: true,
          },
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 2, plottype: 'line', trackPrice: false, transparency: 0, visible: true, color: '#22d3ee' },
            plot_baseline: { linestyle: 0, linewidth: 1, plottype: 'line', trackPrice: false, transparency: 100, visible: false, color: '#000000' },
          },
          filledAreasStyle: {
            fill_0: {
              fillType: 'gradient',
              transparency: 55,
              visible: true,
            },
            fill_1: {
              color: '#22d3ee',
              transparency: 88,
              visible: true,
            },
          },
          inputs: {},
        },
        styles: {
          plot_0: { title: tFunc('chart.indicators.aggregatedOpenInterest'), histogramBase: 0, joinPoints: true, zorder: 1 },
          plot_baseline: { title: 'Baseline', histogramBase: 0, joinPoints: true, zorder: 0 },
        },
        palettes: {},
        inputs: [],
        format: { type: 'volume', precision: 0 },
      },
      constructor () {
        this.init = function (context: any, inputCallback: any) {
          this._context = context
          this._input = inputCallback
        }
        this.main = function (context: any) {
          this._context = context
          const time = PineJS.Std.time(context)

          const vTime = typeof time === 'number' && Number.isFinite(time) ? time : 0

          // 尝试从真实数据中获取
          let oi: number | null = null
          if (oiDataRef?.current && vTime > 0) {
            const { timestamps, values } = oiDataRef.current
            const tolerance = Math.max(5 * 60 * 1000, intervalMs)
            oi = findClosestValue(timestamps, values, vTime, tolerance)
          }

          // 如果没有真实数据，降级到 mock 数据
          if (oi === null) {
            const vol = PineJS.Std.volume(context)
            const close = PineJS.Std.close(context)
            const vVol = typeof vol === 'number' && Number.isFinite(vol) ? vol : 0
            const vClose = typeof close === 'number' && Number.isFinite(close) ? close : 0

            const base = 650_000
            const wave1 = Math.sin(vTime / 8.6e7) * 70_000
            const wave2 = Math.sin(vTime / 2.2e7) * 35_000
            const wave3 = Math.sin(vClose / 180) * 18_000
            const noise = (vVol - 150) * 420
            oi = Math.max(0, base + wave1 + wave2 + wave3 + noise)
          }

          return [oi, 0]
        }
      },
    }

    const IND_VOL = {
      name: names['aggregated-volume'],
      metainfo: mkBaseMeta(
        'Coinflux_VOL@tv-basicstudies-1',
        names['aggregated-volume'],
        tFunc('chart.indicators.aggregatedVolume'),
        // 注意：StudyPlotType 没有 histogram；柱状/直方图是通过 line plot + plottype 来实现的
        [{ id: 'plot_0', type: 'line' }],
        {
          styles: {
            // 目标：和截图一致的纯绿色柱状成交量（更接近 TV 原生 Volume 观感）
            plot_0: {
              // Charting Library 类型：LineStudyPlotStyleName
              // IMPORTANT:
              // - 我们这个 build 的运行时用的是数字枚举（内置 Volume 就是 plottype: 5）
              // - 写字符串会被忽略，从而退回普通折线
              plottype: 5,
              color: '#22c55e',
              linestyle: 0,
              linewidth: 1,
              transparency: 0,
              trackPrice: false,
              histogramBase: 0,
              visible: true,
            },
          },
          inputs: {},
        },
        { plot_0: { title: tFunc('chart.indicators.aggregatedVolume'), histogramBase: 0, joinPoints: false } },
        { type: 'volume', precision: 0 },
      ),
      constructor () {
        this.init = function (context: any, inputCallback: any) {
          this._context = context
          this._input = inputCallback
        }
        this.main = function (context: any) {
          this._context = context
          const vRaw = PineJS.Std.volume(context)
          const v = typeof vRaw === 'number' && Number.isFinite(vRaw) ? vRaw : 0
          return [Math.max(0, v)]
        }
      },
    }

    const IND_LIQ = {
      name: names['liquidation-data'],
      metainfo: mkBaseMeta(
        'Coinflux_LIQ@tv-basicstudies-1',
        names['liquidation-data'],
        tFunc('chart.indicators.liquidationData'),
        [
          // ✅ 对齐“之前效果”：上下双向直方图 + 图例显示 L/S/T
          { id: 'plot_s', type: 'line' }, // S (+) histogram
          { id: 'plot_l', type: 'line' }, // L (-) histogram
          { id: 'plot_t', type: 'line' }, // Total (legend only, hidden)
        ],
        {
          styles: {
            // 目标：像你第 2 张图那样，同一时间点同时显示 L/S 两组爆仓量：
            // - S（空单爆仓）绿色，显示在 0 轴上方
            // - L（多单爆仓）红色，显示在 0 轴下方（用负值）
            // 同上：使用运行时数字枚举（与内置 Volume 一致）
            plot_s: { plottype: 5, color: '#22c55e', trackPrice: false, histogramBase: 0, visible: true, linestyle: 0, linewidth: 1, transparency: 0 },
            plot_l: { plottype: 5, color: '#ef4444', trackPrice: false, histogramBase: 0, visible: true, linestyle: 0, linewidth: 1, transparency: 0 },
            // Total: 不画出来，但用于 legend 数值
            plot_t: { plottype: 0, color: '#94a3b8', trackPrice: false, visible: false, transparency: 100, linewidth: 1, linestyle: 0 },
          },
          inputs: {},
        },
        // 图例顺序 & 文案：L(红) / S(绿)
        {
          plot_l: { title: 'L', histogramBase: 0, joinPoints: false },
          plot_s: { title: 'S', histogramBase: 0, joinPoints: false },
          plot_t: { title: 'T', histogramBase: 0, joinPoints: false },
        },
        { type: 'volume', precision: 0 },
      ),
      constructor () {
        this.init = function (context: any, inputCallback: any) {
          this._context = context
          this._input = inputCallback
        }
        this.main = function (context: any) {
          this._context = context
          // ✅ 正确语义：同一时间点同时有多单爆仓(L)和空单爆仓(S)的量
          // mock：用成交量/价格组合出一个“百万级”爆仓量，并用 time 做一个平滑的占比分配
          const closeRaw = PineJS.Std.close(context)
          const volRaw = PineJS.Std.volume(context)
          const timeRaw = PineJS.Std.time(context)

          const close = typeof closeRaw === 'number' && Number.isFinite(closeRaw) ? closeRaw : 0
          const vol = typeof volRaw === 'number' && Number.isFinite(volRaw) ? volRaw : 0
          const t = typeof timeRaw === 'number' && Number.isFinite(timeRaw) ? timeRaw : 0

          // 量级：close*vol 大约是 1e8 级，乘 0.03~0.08 得到 3M~12M 左右（接近你图里的 $M）
          const baseFactor = 0.05 + Math.sin(t / 3.6e7) * 0.015 // 约 10h 周期缓慢变化
          const total = Math.max(0, close * vol * baseFactor)

          // 分配比例：0.25~0.75 之间来回摆动（保证两边同一时刻同时存在）
          const ratio = 0.5 + Math.sin(t / 1.6e7) * 0.25
          const longL = total * ratio
          const shortS = total * (1 - ratio)

          // 约定：S 画在上方（正值），L 画在下方（负值）
          return [shortS, -longL, total]
        }
      },
    }

    const IND_LIQ_MAP_LEGEND = {
      name: LIQ_MAP_STUDY_NAME,
      metainfo: {
        ...mkBaseMeta(
          'Coinflux_LIQMAP@tv-basicstudies-1',
          LIQ_MAP_STUDY_NAME,
          tFunc('chart.indicators.liquidationMap'),
          [{ id: 'plot_0', type: 'line' }],
          {
            styles: {
              plot_0: {
                // 不绘制（但保留“原生 legend eye/X 按钮”入口）
                linestyle: 0,
                linewidth: 1,
                plottype: 'line',
                trackPrice: false,
                transparency: 100,
                visible: false,
                color: '#000000',
              },
            },
            inputs: {},
          },
          { plot_0: { title: tFunc('chart.indicators.liquidationMap'), histogramBase: 0, joinPoints: false } },
          { type: 'price', precision: 2 },
        ),
        // 关键：挂在主图（价格坐标），不创建新的 pane
        is_price_study: true,
        is_custom_indicator: true,
        is_hidden_study: false,
      },
      constructor () {
        this.init = function (context: any, inputCallback: any) {
          this._context = context
          this._input = inputCallback
        }
        this.main = function (context: any) {
          this._context = context
          // 返回 close，但 visible=false；仅用于出现在 legend 并拥有 eye/X
          const c = PineJS.Std.close(context)
          return [typeof c === 'number' && Number.isFinite(c) ? c : Number.NaN]
        }
      },
    }

    return Promise.resolve([IND_LS, IND_OI, IND_VOL, IND_LIQ, IND_LIQ_MAP_LEGEND])
  }
}

function setButtonActive(btn: HTMLElement | null, active: boolean) {
  if (!btn) return
  if (active) btn.classList.add('is-active')
  else btn.classList.remove('is-active')
}

function createBodyDropdown(anchor: HTMLElement, items: Array<{ label: string; onClick: () => void }>) {
  const doc = anchor.ownerDocument
  const menu = doc.createElement('div')
  menu.style.position = 'fixed'
  menu.style.zIndex = '99999'
  menu.style.minWidth = '120px'
  menu.style.padding = '4px'
  menu.style.borderRadius = '8px'
  menu.style.border = '1px solid #2e2e2e'
  menu.style.background = '#141414' // 深色背景，接近截图
  menu.style.color = '#e5e5e5'
  menu.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)'
  menu.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  const rect = anchor.getBoundingClientRect()
  menu.style.left = `${rect.left}px`
  menu.style.top = `${rect.bottom + 6}px`

  items.forEach((it) => {
    const row = doc.createElement('div')
    row.textContent = it.label
    row.style.padding = '8px 12px'
    row.style.fontSize = '13px'
    row.style.lineHeight = '1.4'
    row.style.cursor = 'pointer'
    row.style.borderRadius = '4px'
    row.style.transition = 'background 0.1s ease'
    
    row.addEventListener('mouseenter', () => {
      row.style.background = '#2a2a2a'
    })
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent'
    })
    row.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      it.onClick()
    })
    menu.appendChild(row)
  })

  return menu
}

function moveButtonsToHeaderRight(widget: any, buttons: HTMLElement[]) {
  try {
    const win =
      (typeof widget?._innerWindow === 'function' ? widget._innerWindow() : undefined) ||
      (widget?._iFrame?.contentWindow as Window | undefined) ||
      (widget?._iframe?.contentWindow as Window | undefined) ||
      (widget?.activeChart?.()?.contentWindow as Window | undefined)
    const doc = win?.document
    if (!doc) return

    // 尽量找到 header 根节点
    const headerRoot =
      doc.querySelector('.header-chart-panel') ||
      doc.querySelector('[class*="header-chart-panel"]') ||
      doc.querySelector('.tradingview-widget-header') ||
      doc.body
    if (!headerRoot) return

    // 只在“顶部区域”内找 header 按钮
    const allButtons = Array.from(headerRoot.querySelectorAll('button'))
      .map((b) => ({ b, rect: b.getBoundingClientRect() }))
      .filter((x) => x.rect.width > 2 && x.rect.height > 2 && x.rect.top >= 0 && x.rect.top < 150)
    
    if (allButtons.length === 0) {
      // 兜底：如果找不到任何按钮，尝试直接 append 到 headerRoot
      buttons.forEach(btn => headerRoot.appendChild(btn))
      return
    }

    allButtons.sort((a, b) => b.rect.right - a.rect.right)
    const rightmostBtn = allButtons[0].b

    let group: HTMLElement | null = rightmostBtn.closest('div')
    while (group) {
      const cs = win.getComputedStyle(group)
      if (cs.display === 'flex' && group.querySelectorAll('button').length >= 1) break
      group = group.parentElement
    }
    if (!group) group = rightmostBtn.parentElement as HTMLElement | null
    if (!group) return

    const groupButtons = Array.from(group.querySelectorAll('button'))
      .map((b) => ({ b, rect: b.getBoundingClientRect() }))
      .filter((x) => x.rect.width > 2 && x.rect.height > 2)
    groupButtons.sort((a, b) => b.rect.right - a.rect.right)
    const anchor = groupButtons[0]?.b || null

    // 放到最右侧：插入到 group 的最后一个按钮之后
    buttons.forEach((btn) => {
      try {
        if (anchor && anchor.parentElement === group) {
          const next = anchor.nextSibling
          if (next) group.insertBefore(btn, next)
          else group.appendChild(btn)
        } else {
          group.appendChild(btn)
        }
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
}

function tryExecuteActionInsertIndicator(widget: any) {
  const chart = widget?.activeChart?.() || widget?.chart?.()
  // Charting Library 不同版本暴露点略有差异，尽量兼容
  try {
    chart?.executeActionById?.('insertIndicator')
    return
  } catch {
    // ignore
  }
  try {
    widget?.activeChart?.()?.executeActionById?.('insertIndicator')
  } catch {
    // ignore
  }
}

export const TradingViewChart = forwardRef((
  {
    symbol = 'BTCUSDT',
    interval = '60',
    theme = 'Light',
    isAggregated = true,
    selectedExchange = 'binance',
    onSelectExchange,
    onToggleAggregate,
    onOpenIndicator,
    onOpenDataIndicator,
    onIntervalChanged,
    onRemoveIndicator,
    activeIndicators = [],
  }: TradingViewChartProps,
  ref: Ref<TradingViewChartRef>,
) => {
  const { t, i18n } = useTranslation()
  const widgetRef = useRef<TradingViewWidget | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isChartReady, setIsChartReady] = useState(false)
  const chartReadyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [currentInterval, setCurrentInterval] = useState(interval)

  // 用 useId() 生成 SSR/CSR 稳定的唯一 id，避免 hydration mismatch
  const reactId = useId()
  const containerId = useMemo(() => `tv_chart_${reactId.replace(/:/g, '')}`, [reactId])
  const containerRef = useRef<HTMLDivElement | null>(null)
  // ---- 清算地图 overlay（Coinglass-style）----
  const overlayRef = useRef<LiquidationMapChartHandle | null>(null)
  const chartAdapterRef = useRef<ChartAdapter | null>(null)
  const [mainPaneHeight, setMainPaneHeight] = useState<number | null>(null)
  const mainPaneHeightRef = useRef<number | null>(null)
  // 清算地图（native drawings）：用 TradingView 的矩形 drawing 来画“右侧柱状热力条”，
  // 这样用户可以通过 TV 自己的对象树(Object Tree)/绘图管理能力进行隐藏/删除。
  const [liqNativeSupported, setLiqNativeSupported] = useState(false)
  const [liqNativeActive, setLiqNativeActive] = useState(false) // 已成功绘制过至少一批 native rectangles
  const [liqHidden, setLiqHidden] = useState(false) // legend 眼睛：隐藏/显示
  const liqHiddenRef = useRef(false)
  const liqNativeShapeIdsRef = useRef<string[]>([])
  const liqNativeRemovingRef = useRef(false)
  const liqNativeMissRef = useRef(0)
  // 清算地图 hover price line：用 TV 的 horizontal_line drawing 显示一个始终正确的价格标签，
  // 避免在 overlay 区域 crosshair 不更新导致的“价格对不上”错觉。
  const liqHoverLineIdRef = useRef<string | null>(null)
  const liqHoverLineCreatingRef = useRef(false)
  const liqHoverLinePendingPriceRef = useRef<number | null>(null)
  const liqHoverLineCreatingSinceRef = useRef<number | null>(null)
  // 清算地图 legend 占位 study（提供 eye/X 按钮）
  const liqLegendStudyIdRef = useRef<string | null>(null)
  const liqLegendStudySeenRef = useRef(false)
  const liqLegendStudyMissRef = useRef(0)
  const liqLegendStudyRemovingRef = useRef(false)
  // 持仓量数据缓存：按时间戳排序的数组
  const openInterestDataRef = useRef<{ timestamps: number[]; values: number[] }>({ timestamps: [], values: [] })
  const [liqSelected, setLiqSelected] = useState<null | {
    locked: boolean
    x: number
    y: number
    price: number
    bybit: number
    okx: number
    binance: number
    dex: number
    cumLong: number
    cumShort: number
  }>(null)
  const liqLockedRef = useRef(false)
  const liqLockedPriceRef = useRef<number | null>(null)
  interface OpenInterestFallbackFields {
    timestamp?: string | number
    openInterest?: number
  }
  const liqSeriesRef = useRef<null | {
    xs: number[]
    bybit: number[]
    okx: number[]
    binance: number[]
    dex: number[]
    cumLong: number[]
    cumShort: number[]
  }>(null)
  const fetchOpenInterestData = useCallback(async (symbolParam: string, shouldCancel?: () => boolean) => {
    try {
      // 提取币种符号（去掉 USDT 后缀）
      const baseSymbol = symbolParam.replace(/USDT$/, '').toUpperCase()
      if (!/^[A-Z0-9]+$/.test(baseSymbol)) {
        oiLogger.warn('Invalid symbol format:', baseSymbol)
        openInterestDataRef.current = { timestamps: [], values: [] }
        return
      }
      if (shouldCancel?.()) return
      oiLogger.debug('Fetching data for:', baseSymbol)

      // 获取最近 100 条数据（符合 API 限制）
      const data = await fetchAggregatedOpenInterest({
        symbol: baseSymbol,
        exchange: 'All',
        limit: 100,
      })
      if (shouldCancel?.()) return
      oiLogger.debug('Received data points:', data.length)
      if (enableOIDebugLogs && data.length > 0) {
        oiLogger.debug('First item structure:', JSON.stringify(data[0], null, 2))
        oiLogger.debug('First item keys:', Object.keys(data[0]))
      }

      const dataPoints: Array<{ timestamp: number; value: number }> = []
      data.forEach((item, index) => {
        const fallbackFields = item as OpenInterestFallbackFields
        const timestampValue = item.data_timestamp ?? fallbackFields.timestamp
        const oiValue = item.open_interest_usd ?? fallbackFields.openInterest

        if (enableOIDebugLogs && index < 3) {
          oiLogger.debug(`Item ${index}:`, {
            data_timestamp: item.data_timestamp,
            open_interest_usd: item.open_interest_usd,
            timestamp: fallbackFields.timestamp,
            openInterest: fallbackFields.openInterest,
            timestampValue,
            oiValue,
            oiValueType: typeof oiValue,
          })
        }

        if (timestampValue != null && typeof oiValue === 'number' && Number.isFinite(oiValue)) {
          let timestamp = new Date(timestampValue).getTime()
          if (!Number.isFinite(timestamp)) return
          if (timestamp < 1e12) {
            timestamp *= 1000
          }
          dataPoints.push({ timestamp, value: oiValue })
        }
      })

      dataPoints.sort((a, b) => a.timestamp - b.timestamp)
      if (shouldCancel?.()) return
      openInterestDataRef.current = {
        timestamps: dataPoints.map((d) => d.timestamp),
        values: dataPoints.map((d) => d.value),
      }
      oiLogger.debug('Cached data points:', dataPoints.length)
      if (data.length > 0 && dataPoints.length === 0) {
        oiLogger.warn('Warning: Received data but all items were filtered out. Check field names.')
        oiLogger.warn('Sample item:', data[0])
      }
      if (dataPoints.length > 0) {
        oiLogger.debug(
          'Time range:',
          new Date(dataPoints[0].timestamp),
          'to',
          new Date(dataPoints[dataPoints.length - 1].timestamp)
        )
      }
    } catch (error) {
      if (shouldCancel?.()) return
      oiLogger.error('Failed to fetch open interest data:', error)
      // 失败时保持空数据，降级到 mock 数据
      openInterestDataRef.current = { timestamps: [], values: [] }
    }
  }, [])
  const liqDataRef = useRef<ReturnType<typeof generateLiquidationMapMockData> | null>(null)
  const liqCurrentPriceRef = useRef<number>(0)
  const [liqData, setLiqData] = useState<ReturnType<typeof generateLiquidationMapMockData> | null>(null)
  const showLiqOverlay = activeIndicators.some((x) => x.id === 'liquidation-map')
  const showLiqOverlayRef = useRef(showLiqOverlay)

  useEffect(() => {
    showLiqOverlayRef.current = showLiqOverlay
  }, [showLiqOverlay])

  useEffect(() => {
    liqDataRef.current = liqData
  }, [liqData])

  useEffect(() => {
    mainPaneHeightRef.current = mainPaneHeight
  }, [mainPaneHeight])

  useEffect(() => {
    liqHiddenRef.current = liqHidden
  }, [liqHidden])

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    oiLogger.debug('Fetching open interest data for symbol:', symbol)
    fetchOpenInterestData(symbol, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [symbol, fetchOpenInterestData])

  // Sync currentInterval with interval prop (for external control)
  useEffect(() => {
    setCurrentInterval(interval)
  }, [interval])

  const { dataRef: lsDataRef, sortedTimestampsRef: lsSortedTimestampsRef } = useLongShortRatioData(symbol, currentInterval)
  const customStudyIdsRef = useRef<Record<CustomIndicatorId, string | null>>({
    'long-short-ratio': null,
    'aggregated-open-interest': null,
    'aggregated-volume': null,
    'liquidation-data': null,
  })
  const pendingEnsuresRef = useRef<Set<CustomIndicatorId>>(new Set())
  const pendingRemovesRef = useRef<Set<CustomIndicatorId>>(new Set())

  const stableInputs = useMemo(() => ({ symbol, interval, theme, language: i18n.language }), [symbol, interval, theme, i18n.language])

  // 这些回调/状态会频繁变化，不能放进 init effect 依赖，否则会导致 widget 被重建。
  const callbacksRef = useRef({
    onToggleAggregate,
    onOpenIndicator,
    onOpenDataIndicator,
    onSelectExchange,
    onRemoveIndicator,
  })
  const stateRef = useRef({ isAggregated, selectedExchange })

  useEffect(() => {
    callbacksRef.current = { onToggleAggregate, onOpenIndicator, onOpenDataIndicator, onSelectExchange, onRemoveIndicator }
  }, [onOpenDataIndicator, onOpenIndicator, onRemoveIndicator, onSelectExchange, onToggleAggregate])

  useEffect(() => {
    stateRef.current = { isAggregated, selectedExchange }
  }, [isAggregated, selectedExchange])

  const headerElsRef = useRef<{
    aggBtn: HTMLElement | null
    aggSwitch: HTMLElement | null
    aggKnob: HTMLElement | null
    aggLabel: HTMLElement | null
    exchangeBtn: HTMLElement | null
    indicatorBtn: HTMLElement | null
    dataIndicatorBtn: HTMLElement | null
    activeMenu: HTMLElement | null
    cleanupMenuListener: (() => void) | null
  }>({
    aggBtn: null,
    aggSwitch: null,
    aggKnob: null,
    aggLabel: null,
    exchangeBtn: null,
    indicatorBtn: null,
    dataIndicatorBtn: null,
    activeMenu: null,
    cleanupMenuListener: null,
  })

  const closeMenu = () => {
    const els = headerElsRef.current
    if (els.activeMenu) {
      try {
        els.activeMenu.remove()
      } catch {
        // ignore
      }
      els.activeMenu = null
    }
    els.cleanupMenuListener?.()
    els.cleanupMenuListener = null
  }

  const updateHeaderUi = () => {
    const { isAggregated: agg, selectedExchange: ex } = stateRef.current
    const els = headerElsRef.current

    // 聚合开关：外观保持与旧页面一致（渐变开/灰色关 + 白色滑块）
    if (els.aggSwitch && els.aggKnob) {
      els.aggSwitch.style.background = agg
        ? 'linear-gradient(90deg, #396bff 0%, #8b5cff 100%)'
        : 'rgba(127,127,127,0.35)'
      els.aggKnob.style.transform = agg ? 'translateX(16px)' : 'translateX(2px)'
    }
    setButtonActive(els.aggBtn, agg)

    // 聚合=关：同一个控件直接显示交易所下拉（不再额外渲染交易所按钮）
    if (els.aggLabel) {
      const exLabel = ex === 'okx' ? 'OKX' : 'Binance'
      const labelText = agg ? t('chart.toolbar.aggregate') : `${t('chart.toolbar.exchange')}: ${exLabel} ▾`
      if (els.aggLabel.textContent !== labelText) {
        els.aggLabel.textContent = labelText
      }
    }

    // 精选指标文案
    if (els.indicatorBtn) {
      const indicatorLabel = t('chart.toolbar.featuredIndicators')
      if (els.indicatorBtn.textContent !== indicatorLabel) {
        els.indicatorBtn.textContent = indicatorLabel
      }
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      addStudy(studyName: string) {
        const widget = widgetRef.current
        if (!widget || !chartReadyRef.current) return
        const chart = widget?.activeChart?.() || widget?.chart?.()
        try {
          if (chart?.createStudy) {
            // Passing inputs as array is deprecated; use object.
            resolveMaybePromiseId(chart.createStudy(studyName, false, false, {}), () => {
              // ignore id for built-in studies
            })
            return
          }
        } catch {
          // fallthrough to native indicator dialog
        }
        // fallback：打开 TV 原生指标面板，让用户手动选择（兼容 studyName 不可用的情况）
        tryExecuteActionInsertIndicator(widget)
      },
      ensureCustomIndicator(id: CustomIndicatorId) {
        const widget = widgetRef.current
        if (!widget || !chartReadyRef.current) {
          pendingRemovesRef.current.delete(id)
          pendingEnsuresRef.current.add(id)
          return
        }
        const chart = widget?.activeChart?.() || widget?.chart?.()
        const name = CUSTOM_STUDY_NAME_BY_ID[id]
        if (!name) return
        // Prevent duplicate createStudy calls (toggle + sync effect, or rapid clicks).
        if (customStudyIdsRef.current[id]) return
        // If the study already exists (e.g. from earlier buggy double-creates), reuse the first one and
        // delete the duplicates to restore the expected “only one pane per indicator” behavior.
        const existingId = findAndDedupeStudyByName(chart, name)
        if (existingId) {
          customStudyIdsRef.current[id] = existingId
          return
        }
        try {
          customStudyIdsRef.current[id] = PENDING_STUDY_ID
          const maybe = chart?.createStudy?.(name, false, false, {})
          resolveMaybePromiseId(maybe, (sid) => {
            customStudyIdsRef.current[id] = sid
          })
        } catch {
          // ignore
          customStudyIdsRef.current[id] = null
        }
      },
      removeCustomIndicator(id: CustomIndicatorId) {
        const widget = widgetRef.current
        if (!widget || !chartReadyRef.current) {
          pendingEnsuresRef.current.delete(id)
          pendingRemovesRef.current.add(id)
          customStudyIdsRef.current[id] = null
          return
        }
        const chart = widget?.activeChart?.() || widget?.chart?.()
        const studyId = customStudyIdsRef.current[id]
        if (!studyId) {
          // fallback: remove by name in case local ref was lost
          const name = CUSTOM_STUDY_NAME_BY_ID[id]
          if (!name) return
          const existingId = findAndDedupeStudyByName(chart, name)
          if (existingId) {
            try {
              chart?.removeEntity?.(existingId)
            } catch {
              // ignore
            }
          }
          return
        }
        if (studyId === PENDING_STUDY_ID) {
          // Study is being created; schedule removal and clear local marker.
          pendingEnsuresRef.current.delete(id)
          pendingRemovesRef.current.add(id)
          customStudyIdsRef.current[id] = null
          return
        }
        try {
          chart?.removeEntity?.(studyId)
        } catch {
          // ignore
        }
        customStudyIdsRef.current[id] = null
      },
      removeAllStudies() {
        const widget = widgetRef.current
        if (!widget || !chartReadyRef.current) return
        const chart = widget?.activeChart?.() || widget?.chart?.()
        try {
          if (chart?.removeAllStudies) {
            chart.removeAllStudies()
            customStudyIdsRef.current = {
              'long-short-ratio': null,
              'aggregated-open-interest': null,
              'aggregated-volume': null,
              'liquidation-data': null,
            }
            return
          }
        } catch {
          // ignore
        }
        try {
          const studies = chart?.getAllStudies?.() as Array<{ id: string }> | undefined
          if (Array.isArray(studies) && typeof chart?.removeEntity === 'function') {
            studies.forEach((s) => {
              try {
                chart.removeEntity(s.id)
              } catch {
                // ignore
              }
            })
          }
        } catch {
          // ignore
        }
        customStudyIdsRef.current = {
          'long-short-ratio': null,
          'aggregated-open-interest': null,
          'aggregated-volume': null,
          'liquidation-data': null,
        }
      },
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    let readyTimer: ReturnType<typeof setTimeout> | null = null

    async function init() {
      // 延迟一帧执行，确保 DOM 已经挂载
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (cancelled) return

      try {
        setError(null)
        setIsReady(false)
        setIsChartReady(false)
        chartReadyRef.current = false

        await loadTradingViewScript()
        if (cancelled) return

        const TradingView = window.TradingView
        if (!TradingView?.widget) {
          throw new Error('TradingView.widget is not available. 请检查 library_path 是否正确。')
        }

        // 使用 ref 获取容器，避免 dev StrictMode / 异步初始化导致的时序问题
        let containerEl = containerRef.current
        // 兜底：最多等 ~10 帧
        for (let i = 0; i < 10 && !containerEl && !cancelled; i += 1) {
           
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          containerEl = containerRef.current
        }
        if (cancelled) return
        if (!containerEl) throw new Error(`Chart container not found: #${containerId}`)

        // 在销毁/重建场景下，确保容器是干净的，避免残留 iframe/节点影响初始化
        containerEl.innerHTML = ''

        // HMR 场景下避免重复实例
        widgetRef.current?.remove?.()
        widgetRef.current = null

        // 同时设置 container_id + container：
        // - 你要求的关键参数是 container_id
        // - 但当前 charting_library.js 内部实现读取的是 options.container
        // eslint-disable-next-line new-cap -- TradingView Charting Library API is `new TradingView.widget(...)`
        const widget = new TradingView.widget({
          container_id: containerId,
          // 用真实 DOM 节点更稳（避免内部 query 时机差）
          container: containerEl,

          library_path: LIBRARY_PATH, // 必须严格使用 '/tradingview/charting_library/'
          locale: i18n.language.startsWith('zh') ? 'zh' : 'en',
          timezone: 'Etc/UTC',
          autosize: true,
          theme,

          symbol,
          interval,

          datafeed: mockDatafeed,
          custom_indicators_getter: createCustomIndicatorsGetter({
            theme,
            t,
            openInterestDataRef,
            interval,
            lsDataRef,
            lsSortedTimestampsRef,
          }),
          // Ensure legend action buttons (eye/delete) are functional.
          // NOTE: This build gates legend actions behind these feature flags.
          // - `study_buttons_in_legend` is used internally (not always present in d.ts), but exists in our bundle.
          enabled_features: ['show_hide_button_in_legend', 'delete_button_in_legend', 'legend_inplace_edit', 'study_buttons_in_legend'],
          // Keep disabled to avoid incompatible persisted settings schema warnings.
          disabled_features: ['use_localstorage_for_settings'],
        }) as TradingViewWidget

        widgetRef.current = widget
        setIsReady(true)

        // Chart must be ready before calling activeChart()/chart() on some versions, or it can crash.
        try {
          const markReady = () => {
            if (cancelled) return
            if (chartReadyRef.current) return
            chartReadyRef.current = true
            setIsChartReady(true)
          }

          widget.onChartReady(() => markReady())
          // Fallback 1: header ready usually implies chart core is usable
          widget.headerReady?.().then(() => markReady()).catch(() => {
            /* ignore */
          })
          // Fallback 2: last resort time-based (guarded + overlay effect has try/catch)
          readyTimer = setTimeout(() => markReady(), 1500)

          // Listen for interval changes
          widget.onChartReady(() => {
            try {
              const chart = widget?.activeChart?.() || widget?.chart?.()
              chart?.onIntervalChanged?.().subscribe(null, (newInterval: string) => {
                setCurrentInterval(newInterval)
                onIntervalChanged?.(newInterval)
              })
            } catch (error) {
              void error
            }
          })
        } catch {
          // ignore
        }

        // Apply any queued indicator operations (from UI clicks before widget is ready, or state rehydration).
        try {
          const chart = widget?.activeChart?.() || widget?.chart?.()
          // removals first
          for (const id of pendingRemovesRef.current) {
            const sid = customStudyIdsRef.current[id]
            if (sid && sid !== PENDING_STUDY_ID) {
              try {
                chart?.removeEntity?.(sid)
              } catch {
                // ignore
              }
            }
            customStudyIdsRef.current[id] = null
          }
          pendingRemovesRef.current.clear()

          for (const id of pendingEnsuresRef.current) {
            const name = CUSTOM_STUDY_NAME_BY_ID[id]
            if (!name) continue
            if (customStudyIdsRef.current[id]) continue
            try {
              const existingId = findAndDedupeStudyByName(chart, name)
              if (existingId) {
                customStudyIdsRef.current[id] = existingId
                continue
              }
              customStudyIdsRef.current[id] = PENDING_STUDY_ID
              const maybe = chart?.createStudy?.(name, false, false, {})
              resolveMaybePromiseId(maybe, (sid) => {
                customStudyIdsRef.current[id] = sid
              })
            } catch {
              // ignore
              customStudyIdsRef.current[id] = null
            }
          }
          pendingEnsuresRef.current.clear()
        } catch {
          // ignore
        }

        // 在 TradingView header 注入自定义按钮（聚合/交易所/指标/精选指标）
        try {
          widget.headerReady?.().then(() => {
            if (cancelled) return
            // 清理旧 menu（如果有）
            closeMenu()

            // 聚合（显示开/关）
            const aggBtn: HTMLElement = widget.createButton()
            aggBtn.classList.add('tv-custom-btn')
            aggBtn.style.display = 'flex'
            aggBtn.style.alignItems = 'center'
            aggBtn.style.gap = '8px'
            aggBtn.style.padding = '0 10px'

            const aggLabel = document.createElement('span')
            aggLabel.textContent = t('chart.toolbar.aggregate')
            aggLabel.style.fontSize = '12px'
            aggLabel.style.fontWeight = '700'
            aggLabel.style.cursor = 'pointer'

            const aggSwitch = document.createElement('span')
            aggSwitch.style.position = 'relative'
            aggSwitch.style.width = '34px'
            aggSwitch.style.height = '18px'
            aggSwitch.style.borderRadius = '9999px'
            aggSwitch.style.transition = 'background 150ms ease'
            aggSwitch.style.cursor = 'pointer'

            const aggKnob = document.createElement('span')
            aggKnob.style.position = 'absolute'
            aggKnob.style.top = '2px'
            aggKnob.style.left = '0px'
            aggKnob.style.width = '14px'
            aggKnob.style.height = '14px'
            aggKnob.style.borderRadius = '9999px'
            aggKnob.style.background = '#fff'
            aggKnob.style.transition = 'transform 150ms ease'

            aggSwitch.appendChild(aggKnob)
            aggBtn.appendChild(aggLabel)
            aggBtn.appendChild(aggSwitch)

            // 交互约定：
            // - 点击开关：切换聚合开/关
            // - 当聚合=关时，点击文字区域：直接下拉选择交易所（不再出现单独的交易所按钮）
            aggSwitch.addEventListener('click', (e) => {
              e.preventDefault()
              e.stopPropagation()
              callbacksRef.current.onToggleAggregate?.()
            })

            aggLabel.addEventListener('click', (e) => {
              e.preventDefault()
              e.stopPropagation()

              // 聚合=开：文字仅展示，不弹出交易所
              if (stateRef.current.isAggregated) return

              // toggle dropdown
              const els = headerElsRef.current
              if (els.activeMenu) {
                closeMenu()
                return
              }

              const menu = createBodyDropdown(aggLabel, [
                {
                  label: 'Binance',
                  onClick: () => {
                    closeMenu()
                    callbacksRef.current.onSelectExchange?.('binance')
                  },
                },
                {
                  label: 'OKX',
                  onClick: () => {
                    closeMenu()
                    callbacksRef.current.onSelectExchange?.('okx')
                  },
                },
              ])
              const doc = aggLabel.ownerDocument
              doc.body.appendChild(menu)
              els.activeMenu = menu

              const onDoc = (evt: MouseEvent) => {
                const target = evt.target as Node | null
                if (!target) return
                if (menu.contains(target) || aggBtn.contains(target)) return
                closeMenu()
              }
              // 监听 iframe 内部点击
              doc.addEventListener('mousedown', onDoc, true)
              // 同时也尝试监听主文档点击（如果 iframe 未跨域）
              document.addEventListener('mousedown', onDoc, true)

              els.cleanupMenuListener = () => {
                doc.removeEventListener('mousedown', onDoc, true)
                document.removeEventListener('mousedown', onDoc, true)
              }
            })

            // 精选指标（打开你们原来的弹窗）
            const indicatorBtn = widget.createButton()
            indicatorBtn.classList.add('tv-custom-btn')
            const indicatorLabel = t('chart.toolbar.featuredIndicators')
            indicatorBtn.textContent = indicatorLabel
            indicatorBtn.addEventListener('click', (e) => {
              e.preventDefault()
              e.stopPropagation()
              callbacksRef.current.onOpenIndicator?.()
            })

            headerElsRef.current.aggBtn = aggBtn
            headerElsRef.current.aggSwitch = aggSwitch
            headerElsRef.current.aggKnob = aggKnob
            headerElsRef.current.aggLabel = aggLabel
            headerElsRef.current.indicatorBtn = indicatorBtn
            // headerElsRef.current.dataIndicatorBtn = dataIndicatorBtn

            // 将“聚合开关 + 交易所选择”放到 header 右侧（与旧页面右侧工具区一致）
            // 末尾顺序：交易所 → 聚合（聚合开关在最右侧）
            moveButtonsToHeaderRight(widget, [aggBtn])

            // 首次渲染状态
            updateHeaderUi()
          })
        } catch {
          // ignore
        }
      } catch (e) {
        const message = (e as Error)?.message || 'Unknown error'
        setError(message)
      }
    }

    void init()

    return () => {
      cancelled = true
      if (readyTimer) clearTimeout(readyTimer)
      closeMenu()
      widgetRef.current?.remove?.()
      widgetRef.current = null
      chartReadyRef.current = false
      setIsChartReady(false)
    }
  }, [stableInputs])

  // state 变化只更新 header 文案/可见性，不重建 widget
  useEffect(() => {
    updateHeaderUi()
     
  }, [isAggregated, selectedExchange])

  // === 清算地图 overlay：挂接适配器 + 生成数据 + hover/click 交互 ===
  // IMPORTANT: 只有在 isChartReady=true 后才允许触碰 activeChart()/chart()（否则某些版本会崩）。
  useEffect(() => {
    const widget = widgetRef.current
    if (!widget || !isReady || !isChartReady) return

    let cleanup: null | (() => void) = null

    const safe = <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: any[]) => {
        try {
          return fn(...args)
        } catch (e) {
          console.warn('[liq-overlay] error', e)
          return undefined
        }
      }) as T
    }

    try {
      const chart = widget?.activeChart?.() || widget?.chart?.()
      if (!chart) return

      const containerEl = document.getElementById(containerId)
      if (!containerEl) return

      const computeMainPaneHeight = () => {
        try {
          const panes = chart?.getPanes?.()
          const h = panes?.[0]?.getHeight?.()
          if (typeof h === 'number' && Number.isFinite(h) && h > 0) setMainPaneHeight(h)
        } catch {
          // ignore
        }
      }

      const getVisibleRangeMidPrice = (): number | null => {
        try {
          const panes = chart?.getPanes?.()
          const pane = Array.isArray(panes) && panes.length ? panes[0] : null
          const scale = pane?.getMainSourcePriceScale?.()
          const r = scale?.getVisiblePriceRange?.()
          const from = r?.from
          const to = r?.to
          if (typeof from !== 'number' || typeof to !== 'number' || !Number.isFinite(from) || !Number.isFinite(to)) return null
          return (from + to) / 2
        } catch {
          return null
        }
      }

      computeMainPaneHeight()

      const adapter = createTradingViewChartAdapter({
        widget,
        containerEl,
        getCurrentPrice: () => liqCurrentPriceRef.current,
      })
      chartAdapterRef.current = adapter

      const refreshOverlay = () => overlayRef.current?.refresh()

      let paneSizeTimer: ReturnType<typeof setInterval> | null = null
      let drawingsGcTimer: ReturnType<typeof setInterval> | null = null
      let drawingsSyncTimer: ReturnType<typeof setTimeout> | null = null
      let drawingsSyncPending = false
      let legendStudyTimer: ReturnType<typeof setInterval> | null = null

      const hexWithAlpha = (hex: string, alpha01: number) => {
        const h = String(hex || '').trim()
        if (!/^#?[0-9a-f]{6}$/i.test(h)) return h
        const base = h.startsWith('#') ? h : `#${h}`
        const a = Math.max(0, Math.min(1, alpha01))
        const aa = Math.round(a * 255)
          .toString(16)
          .padStart(2, '0')
        return `${base}${aa}`
      }

      const safeGetVisibleTimeRangeSec = (): { from: number; to: number } | null => {
        try {
          const r =
            (typeof chart?.getVisibleRange === 'function' ? chart.getVisibleRange() : null) ||
            (typeof chart?.timeScale === 'function' ? chart.timeScale?.()?.getVisibleRange?.() : null) ||
            null

          const normalizeTimeSec = (v: any): number | null => {
            if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v)
            if (typeof v === 'string') {
              const n = Number(v)
              if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
            }
            // Charting Library 有时会返回 { timestamp: number } 或 { time: number }
            const ts = v?.timestamp ?? v?.time
            if (typeof ts === 'number' && Number.isFinite(ts)) return ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts)
            // BusinessDay: { year, month, day }
            const y = v?.year
            const m = v?.month
            const d = v?.day
            if ([y, m, d].every((x) => typeof x === 'number' && Number.isFinite(x))) {
              const ms = Date.UTC(y, m - 1, d)
              return Math.floor(ms / 1000)
            }
            return null
          }

          const from = normalizeTimeSec((r as any)?.from)
          const to = normalizeTimeSec((r as any)?.to)
          if (typeof from === 'number' && typeof to === 'number' && Number.isFinite(from) && Number.isFinite(to) && to > from) {
            return { from, to }
          }

          // 兜底：如果 TV 不暴露可视时间区间（或返回的是 bar index），先用“现在”的时间范围，
          // 这样至少不会空白；后续 onVisibleRangeChanged 会触发重绘对齐。
          const now = Math.floor(Date.now() / 1000)
          return { from: now - 3600 * 24, to: now }
        } catch {
          return null
        }
      }

      const removeAllLiqDrawings = () => {
        const ids = liqNativeShapeIdsRef.current
        if (!ids.length) return
        try {
          liqNativeRemovingRef.current = true
          for (const id of ids) {
            try {
              chart?.removeEntity?.(id)
            } catch {
              // ignore
            }
          }
        } finally {
          liqNativeRemovingRef.current = false
          liqNativeShapeIdsRef.current = []
          liqNativeMissRef.current = 0
          setLiqNativeActive(false)
        }
      }

      const removeLiqHoverLine = () => {
        const id = liqHoverLineIdRef.current
        liqHoverLineCreatingRef.current = false
        liqHoverLinePendingPriceRef.current = null
        liqHoverLineCreatingSinceRef.current = null
        if (!id) return
        try {
          chart?.removeEntity?.(id as any)
        } catch {
          // ignore
        } finally {
          liqHoverLineIdRef.current = null
        }
      }

      const upsertLiqHoverLine = (price: number) => {
        if (!Number.isFinite(price)) return
        if (typeof chart?.createMultipointShape !== 'function') return
        if (liqHiddenRef.current) return
        liqHoverLinePendingPriceRef.current = price
        const tr = safeGetVisibleTimeRangeSec()
        const time = tr?.to ?? Math.floor(Date.now() / 1000)
        const id = liqHoverLineIdRef.current
        if (id) {
          try {
            chart?.getShapeById?.(id as any)?.setPoints?.([{ time, price } as any])
          } catch {
            // ignore
          }
          return
        }

        // Avoid duplicate creation while the createShape promise hasn't resolved yet.
        if (liqHoverLineCreatingRef.current) {
          const since = liqHoverLineCreatingSinceRef.current
          const ageMs = since ? Date.now() - since : null

          // Circuit-breaker: if creation appears stalled, reset and try again.
          if (typeof ageMs === 'number' && Number.isFinite(ageMs) && ageMs > 1500) {
            liqHoverLineCreatingRef.current = false
            liqHoverLineCreatingSinceRef.current = null
          } else {
          return
          }
        }

        liqHoverLineCreatingRef.current = true
        liqHoverLineCreatingSinceRef.current = Date.now()
        try {
          const lineColor = theme === 'Dark' ? '#22c55e' : '#16a34a'
          const maybe = chart.createMultipointShape(
            [{ time, price } as any],
            {
              shape: 'horizontal_line',
              text: '',
              showInObjectsTree: false,
              lock: true,
              disableSelection: true,
              disableSave: true,
              zOrder: 'top',
              overrides: {
                linecolor: lineColor,
                linewidth: 1,
              } as any,
            } as any,
          )
          const onResolved = (newId: any) => {
            liqHoverLineCreatingRef.current = false
            liqHoverLineCreatingSinceRef.current = null
            if (!newId) return
            liqHoverLineIdRef.current = String(newId)
            // Apply latest pending price immediately (user may have moved mouse while create was in-flight).
            const latest = liqHoverLinePendingPriceRef.current
            if (typeof latest === 'number' && Number.isFinite(latest)) {
              try {
                const tr2 = safeGetVisibleTimeRangeSec()
                const time2 = tr2?.to ?? Math.floor(Date.now() / 1000)
                chart?.getShapeById?.(String(newId) as any)?.setPoints?.([{ time: time2, price: latest } as any])
              } catch {
                // ignore
              }
            }
          }
          if (maybe && typeof (maybe as any).then === 'function') {
            void (maybe as Promise<any>)
              .then(onResolved)
              .catch(() => {
                liqHoverLineCreatingRef.current = false
                liqHoverLineCreatingSinceRef.current = null
              })
          } else {
            onResolved(maybe)
          }
        } catch {
          liqHoverLineCreatingRef.current = false
          liqHoverLineCreatingSinceRef.current = null
          // ignore
        }
      }

      const buildAndDrawLiqMap = (data: ReturnType<typeof generateLiquidationMapMockData>) => {
        if (!data) return
        if (liqHiddenRef.current) return
        if (typeof chart?.createMultipointShape !== 'function') return
        const tr = safeGetVisibleTimeRangeSec()
        if (!tr) return

        // 为避免性能问题，我们对价格阶梯做采样（保留整体观感 + tooltip 插值仍然精细）
        const xs = data.labels.map(parsePriceLabel).filter((n) => typeof n === 'number' && Number.isFinite(n)) as number[]
        if (!xs.length) return

        // step：用于把每一条 bar 变成一个“有厚度”的矩形
        const step = xs.length >= 2 ? Math.abs(xs[1] - xs[0]) : Math.max(1, Math.abs((xs[0] || 0) * 0.001))
        const half = step / 2

        // 计算强度（总量），并取 max 用于归一化宽度
        const totals = xs.map((_, i) => (data.bybit[i] || 0) + (data.okx[i] || 0) + (data.binance[i] || 0) + (data.dex[i] || 0))
        const maxVal = Math.max(1, ...totals)

        // 矩形绘制区域固定在可视时间范围的最右侧一小段（视觉上贴近“右侧柱状热力条”）
        const span = Math.max(60 * 10, Math.floor((tr.to - tr.from) * 0.12)) // 至少 10min，最多 ~12% 视窗宽度
        const right = tr.to

        const fillBase = theme === 'Dark' ? '#22c55e' : '#16a34a'
        const borderBase = theme === 'Dark' ? '#1d4ed8' : '#2563eb'

        // 重建：先清理旧的，再创建新的（我们做了采样，所以数量可控）
        removeAllLiqDrawings()
        const created: string[] = []
        const pending: Promise<void>[] = []

        // 采样：每 2 条取 1 条，同时过滤掉极小值
        for (let i = 0; i < xs.length; i += 2) {
          const v = totals[i] || 0
          if (v <= 0.5) continue
          const t = Math.max(0, Math.min(1, v / maxVal))
          const width = Math.max(2, Math.floor(span * t))
          const left = Math.max(tr.from, right - width)

          const price = xs[i]
          const p1 = price - half
          const p2 = price + half

          const bg = hexWithAlpha(fillBase, 0.10 + 0.55 * t)
          const border = hexWithAlpha(borderBase, 0.18 + 0.60 * t)

          try {
            const maybe = chart.createMultipointShape(
              [
                { time: left, price: p2 },
                { time: right, price: p1 },
              ],
              {
                shape: 'rectangle',
                text: LIQ_MAP_DRAWING_LABEL,
                showInObjectsTree: true,
                lock: false,
                disableSelection: false,
                disableSave: true,
                zOrder: 'top',
                overrides: {
                  backgroundColor: bg,
                  borderColor: border,
                  borderWidth: 1,
                },
              },
            )
            // 有些 Charting Library build 返回 Promise<EntityId>
            if (maybe && typeof (maybe as any).then === 'function') {
              pending.push(
                (maybe as Promise<any>)
                  .then((id) => {
                    if (id) created.push(String(id))
                  })
                  .catch(() => {
                    /* ignore */
                  }),
              )
            } else if (maybe) {
              created.push(String(maybe))
            }
          } catch {
            // ignore single bar failures
          }
        }

        if (pending.length) {
          void Promise.all(pending).then(() => {
            liqNativeShapeIdsRef.current = created
            liqNativeMissRef.current = 0
            setLiqNativeActive(created.length > 0)
          })
        } else {
          liqNativeShapeIdsRef.current = created
          liqNativeMissRef.current = 0
          setLiqNativeActive(created.length > 0)
        }
      }

      const scheduleDrawingsSync = () => {
        if (!showLiqOverlayRef.current) return
        if (typeof chart?.createMultipointShape !== 'function') return
        if (liqHiddenRef.current) return
        if (drawingsSyncPending) return
        drawingsSyncPending = true
        drawingsSyncTimer = setTimeout(() => {
          drawingsSyncPending = false
          const d = liqDataRef.current
          if (d) buildAndDrawLiqMap(d)
        }, 120)
      }

      if (showLiqOverlay) {
        // 显示时默认不隐藏（避免上一次隐藏状态残留导致“看起来没效果”）
        if (liqHiddenRef.current) setLiqHidden(false)

        // 1) 创建 legend 占位 study（这样清算地图会出现在指标 legend 上，并且有 eye/X 按钮）
        // 防御：历史遗留的错误值（把 Promise stringify 成了 "[object Promise]"）会导致后续定位/删除全部失效
        if (liqLegendStudyIdRef.current && String(liqLegendStudyIdRef.current).includes('Promise')) {
          liqLegendStudyIdRef.current = null
          liqLegendStudySeenRef.current = false
          liqLegendStudyMissRef.current = 0
        }
        if (!liqLegendStudyIdRef.current) {
          try {
            const maybe = chart?.createStudy?.(LIQ_MAP_STUDY_NAME, false, false, {})
            if (maybe && typeof (maybe as any).then === 'function') {
              void (maybe as Promise<any>)
                .then((id) => {
                  if (!id) return
                  liqLegendStudyIdRef.current = String(id)
                  liqLegendStudySeenRef.current = false
                  liqLegendStudyMissRef.current = 0
                })
                .catch(() => {
                  /* ignore */
                })
            } else if (maybe) {
              liqLegendStudyIdRef.current = String(maybe)
              liqLegendStudySeenRef.current = false
              liqLegendStudyMissRef.current = 0
            }
          } catch {
            // ignore
          }
        }

        // 1.1) 绑定 legend eye/X 点击（部分 build 虽然显示按钮，但点击没有效果；这里我们兜底实现）
        let _legendUiCleanup: null | (() => void) = null
        try {
          let retryTimer: ReturnType<typeof setTimeout> | null = null

          const attach = () => {
            const iframe = containerEl.querySelector('iframe') as HTMLIFrameElement | null
            const doc = iframe?.contentDocument
            if (!doc) {
              retryTimer = setTimeout(attach, 250)
              return
            }
            let liqLegendRowEl: HTMLElement | null = null

            const isActionEl = (el: Element | null, keywords: string[]) => {
              if (!el) return false
              const title = (el as HTMLElement).getAttribute('title') || ''
              const aria = (el as HTMLElement).getAttribute('aria-label') || ''
              const combined = `${title} ${aria}`.toLowerCase()
              // 增加英文关键字匹配
              const enKeywords = ['remove', 'close', 'hide', 'show', 'visibility', 'eye']
              return keywords.concat(enKeywords).some((k) => combined.includes(k.toLowerCase()))
            }
            const isRemoveEl = (el: Element | null) =>
              isActionEl(el, ['删除', '移除', 'x'])
            const isVisibilityEl = (el: Element | null) =>
              isActionEl(el, ['隐藏', '显示'])

            // ✅ 事件驱动的 legend 行定位：从用户点击目标向上找包含“清算地图”的那一行
            const findRowFromTarget = (target: Element): HTMLElement | null => {
              const nameCandidates = ['清算地图', t('chart.indicators.liquidationMap'), 'Liquidation Map'].filter(Boolean)
              let cur: HTMLElement | null = target as any
              for (let i = 0; i < 16 && cur; i += 1) {
                try {
                  const txt = (cur.textContent || '').trim()
                  const hasName = nameCandidates.some((k) => txt.includes(String(k)))
                  const candidates = Array.from(cur.querySelectorAll('button,[role="button"],[tabindex]')) as HTMLElement[]
                  const buttons = candidates.filter((el) => {
                    const r = el.getBoundingClientRect()
                    return r.width > 0 && r.height > 0 && r.width <= 44 && r.height <= 44
                  })
                  const h = cur.getBoundingClientRect().height
                  if (hasName && buttons.length >= 1 && h > 14 && h < 90) return cur
                } catch {
                  // ignore
                }
                cur = cur.parentElement
              }
              return null
            }

            const findLiqLegendRow = () => {
              try {
                const sid = liqLegendStudyIdRef.current
                const nameCandidates = ['清算地图', t('chart.indicators.liquidationMap'), 'Liquidation Map'].filter(Boolean)

                // Strategy 1: textContent XPath (may be 0 on some builds)
                let node: HTMLElement | null = null
                try {
                  // 转义单引号以防万一
                  const escapedName = t('chart.indicators.liquidationMap').replace(/'/g, "\\'")
                  const xpath = `//*[contains(normalize-space(string(.)), "清算地图")] | //*[contains(normalize-space(string(.)), "${escapedName}")] | //*[contains(normalize-space(string(.)), "Liquidation Map")]`
                  const res = doc.evaluate(
                    xpath,
                    doc.body,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null,
                  )
                  node = res.snapshotLength ? (res.snapshotItem(0) as HTMLElement | null) : null
                } catch {
                  // ignore
                }

                // Strategy 2: aria/title search
                if (!node) {
                  const elems = Array.from(doc.querySelectorAll('[title],[aria-label]')) as HTMLElement[]
                  node =
                    elems.find((el) => {
                      const tAttr = `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`
                      return nameCandidates.some((k) => tAttr.includes(k))
                    }) ?? null
                }

                // Strategy 3: data-* / id contains study id
                if (!node && sid) {
                  const sel = [
                    `[data-study-id="${sid}"]`,
                    `[data-entity-id="${sid}"]`,
                    `[data-source-id="${sid}"]`,
                    `[data-id="${sid}"]`,
                    `[data-study-id*="${sid}"]`,
                    `[data-entity-id*="${sid}"]`,
                    `[data-source-id*="${sid}"]`,
                    `[data-id*="${sid}"]`,
                  ].join(',')
                  node = (doc.querySelector(sel) as HTMLElement | null) ?? null
                }

                // Strategy 4: if legend is outside iframe (rare), try parent document within container
                if (!node) {
                  try {
                    const res2 = document.evaluate(
                      `//*[contains(normalize-space(string(.)), "清算地图")]`,
                      containerEl,
                      null,
                      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                      null,
                    )
                    node = res2.snapshotLength ? (res2.snapshotItem(0) as HTMLElement | null) : null
                  } catch {
                    // ignore
                  }
                }

                if (!node) return null

                // climb to row container
                let cur: HTMLElement | null = node
                for (let i = 0; i < 12 && cur; i += 1) {
                  const h = cur.getBoundingClientRect().height
                  const hasButtons = !!cur.querySelector('button,[role="button"],[title],[aria-label],[tabindex]')
                  if (h > 14 && h < 56 && hasButtons) return cur
                  cur = cur.parentElement
                }
                return node.parentElement
              } catch {
                return null
              }
            }

            const bindRow = () => {
              liqLegendRowEl = findLiqLegendRow()
            }
            bindRow()
            const mo = new MutationObserver(() => bindRow())
            try {
              mo.observe(doc.body, { childList: true, subtree: true })
            } catch {
              // ignore
            }

            const resolveRowButtonAction = (row: HTMLElement, target: Element): 'remove' | 'toggle' | null => {
              // 某些 build 的 icon button 没有 title/aria；用“按钮位置”兜底：
              // 约定：legend 行最右侧通常是 remove(X)，其左侧是 hide/show(eye)。
              const btn = (target.closest?.('button,[role="button"],[tabindex]') as HTMLElement | null) ?? null
              const candidates = Array.from(row.querySelectorAll('button,[role="button"],[tabindex]')) as HTMLElement[]
              const buttons = candidates
                .filter((el) => {
                  const r = el.getBoundingClientRect()
                  if (!r || r.width <= 0 || r.height <= 0) return false
                  // 过滤掉整行容器等大块元素
                  return r.width <= 40 && r.height <= 40
                })
                .filter((el, idx, arr) => arr.indexOf(el) === idx)

              // 优先：title/aria 能识别时
              if (btn && (isRemoveEl(btn) || isVisibilityEl(btn))) return isRemoveEl(btn) ? 'remove' : 'toggle'

              // 兜底：用末尾位置判断
              const hitIndex = buttons.findIndex((b) => b === btn || b.contains(btn as any))
              if (hitIndex === -1) return null
              if (hitIndex === buttons.length - 1) return 'remove'
              if (hitIndex === buttons.length - 2) return 'toggle'
              return null
            }

            const onDocPointerDown = (ev: Event) => {
              const target = ev.target as Element | null
              if (!target) return
              const row =
                (liqLegendRowEl && liqLegendRowEl.contains(target) ? liqLegendRowEl : null) || findRowFromTarget(target)
              liqLegendRowEl = row
              if (!row) {
                return
              }
              const action = resolveRowButtonAction(row, target)
              if (!action) return

              // 由我们接管逻辑（避免“点了没反应”）
              ev.preventDefault()
              ;(ev as any).stopPropagation?.()
              ;(ev as any).stopImmediatePropagation?.()

              if (action === 'remove') {
                // 删除：移除 legend study + 关闭指标 + 清理 drawings
                const sid = liqLegendStudyIdRef.current
                if (sid) {
                  try {
                    liqLegendStudyRemovingRef.current = true
                    chart?.removeEntity?.(sid)
                  } catch {
                    // ignore
                  } finally {
                    liqLegendStudyRemovingRef.current = false
                    liqLegendStudyIdRef.current = null
                    liqLegendStudySeenRef.current = false
                    liqLegendStudyMissRef.current = 0
                  }
                }
                setLiqHidden(false)
                removeAllLiqDrawings()
                // 立刻本地隐藏（避免父组件状态同步延迟导致“看起来没效果”）
                setLiqData(null)
                setLiqSelected(null)
                liqLockedRef.current = false
                liqLockedPriceRef.current = null
                callbacksRef.current.onRemoveIndicator?.('liquidation-map')
                return
              }

              if (action === 'toggle') {
                // 隐藏/显示：不改变“已添加”状态，只隐藏 map（drawings + overlay）
                setLiqHidden((prev) => {
                  const next = !prev
                  if (next) {
                    // hide
                    removeAllLiqDrawings()
                    setLiqSelected(null)
                    liqLockedRef.current = false
                    liqLockedPriceRef.current = null
                  } else {
                    // show => redraw
                    const d = liqDataRef.current
                    if (d) buildAndDrawLiqMap(d)
                  }
                  return next
                })
              }
            }

            // 用 pointerdown/mousedown 捕获，优先于内部 click handler，避免内部拦截导致我们收不到事件
            doc.addEventListener('pointerdown', onDocPointerDown, true)
            doc.addEventListener('mousedown', onDocPointerDown, true)
            _legendUiCleanup = () => {
              if (retryTimer) clearTimeout(retryTimer)
              try {
                doc.removeEventListener('pointerdown', onDocPointerDown, true)
                doc.removeEventListener('mousedown', onDocPointerDown, true)
              } catch {
                // ignore
              }
              try {
                mo.disconnect()
              } catch {
                // ignore
              }
            }
          }

          attach()
        } catch {
          // ignore
        }

        // 2) 监听用户通过 legend 的 X 删除 study：被删除后同步关闭清算地图
        legendStudyTimer = setInterval(() => {
          try {
            const sid = liqLegendStudyIdRef.current
            if (!sid) return
            const all = chart?.getAllStudies?.() as Array<{ id: string }> | undefined
            if (!Array.isArray(all)) return

            const exists = all.some((s) => String((s as any).id) === String(sid))
            if (exists) {
              liqLegendStudySeenRef.current = true
              liqLegendStudyMissRef.current = 0
              return
            }

            // 刚创建的短时间内可能还没出现在 getAllStudies 里，不能误判为“已删除”
            if (!liqLegendStudySeenRef.current) return

            liqLegendStudyMissRef.current += 1
            if (liqLegendStudyMissRef.current < 3) return

            liqLegendStudyIdRef.current = null
            liqLegendStudySeenRef.current = false
            liqLegendStudyMissRef.current = 0

            // 用户删除了 legend study：关闭指标（父组件会把 activeIndicators 里移除）
            if (!liqLegendStudyRemovingRef.current) callbacksRef.current.onRemoveIndicator?.('liquidation-map')
          } catch {
            // ignore
          }
        }, 700)

        // Native drawings 支持探测（部分内置精简版可能没有 createMultipointShape）
        setLiqNativeSupported(typeof chart?.createMultipointShape === 'function')

        paneSizeTimer = setInterval(() => computeMainPaneHeight(), 800)
        // 如果用户在 TradingView 自己的 UI（对象树/绘图管理）里把这些矩形全删了，
        // 我们需要把“清算地图”同步为未启用（按钮状态回退）。
        if (typeof chart?.getShapeById === 'function') {
          drawingsGcTimer = setInterval(() => {
            try {
              if (!showLiqOverlayRef.current) return
              if (liqNativeRemovingRef.current) return
              const ids = liqNativeShapeIdsRef.current
              if (!ids.length) return
              const anyAlive = ids.some((id) => {
                try {
                  return !!chart.getShapeById(id)
                } catch {
                  return false
                }
              })
              if (anyAlive) {
                liqNativeMissRef.current = 0
                return
              }
              liqNativeMissRef.current += 1
              if (liqNativeMissRef.current < 2) return

              // 连续两次都找不到，才认为用户真的删干净了
              liqNativeShapeIdsRef.current = []
              liqNativeMissRef.current = 0
              callbacksRef.current.onRemoveIndicator?.('liquidation-map')
            } catch {
              // ignore
            }
          }, 900)
        }

        const computeAndSet = () => {
          const symUpper = String(symbol || 'BTCUSDT').toUpperCase()
          let base = symUpper
          for (const q of ['USDT', 'USD', 'PERP', 'SWAP']) {
            if (base.endsWith(q)) base = base.slice(0, -q.length)
          }
          base = base || symUpper.slice(0, 3) || 'BTC'

          const mid = getVisibleRangeMidPrice() ?? 0
          const fallbackAnchor = liquidationSymbolPrices[base] ?? 100
          const anchor = mid > 0 ? mid : fallbackAnchor
          liqCurrentPriceRef.current = anchor
          const d = generateLiquidationMapMockData(base, '1d', 'All', anchor, 200)
          setLiqData(d)
          // 同步绘制 native rectangles（如果支持）
          try {
            if (typeof chart?.createMultipointShape === 'function') buildAndDrawLiqMap(d)
          } catch {
            // ignore
          }
        }

        // dataReady 后再取可视价格区间，避免刚初始化时拿不到 range 导致 overlay 锚点跑飞
        try {
          if (chart?.dataReady) chart.dataReady(() => computeAndSet())
          else computeAndSet()
        } catch {
          computeAndSet()
        }
      } else {
        // overlay 关闭：移除 legend 占位 study（避免残留 legend 条目），但不要触发 onRemoveIndicator
        const sid = liqLegendStudyIdRef.current
        if (sid) {
          try {
            liqLegendStudyRemovingRef.current = true
            chart?.removeEntity?.(sid)
          } catch {
            // ignore
          } finally {
            liqLegendStudyRemovingRef.current = false
            liqLegendStudyIdRef.current = null
            liqLegendStudySeenRef.current = false
            liqLegendStudyMissRef.current = 0
          }
        }

        removeAllLiqDrawings()
        removeLiqHoverLine()
        setLiqHidden(false)

        setLiqData(null)
        setLiqSelected(null)
        liqLockedRef.current = false
        liqLockedPriceRef.current = null
      }

      const unsubChart = adapter.subscribeChartChange(
        safe(() => {
          refreshOverlay()
          computeMainPaneHeight()
          // K 线缩放/平移时，重新把“右侧矩形条”贴到最新可视右边界
          scheduleDrawingsSync()
          if (liqLockedRef.current && liqLockedPriceRef.current != null) {
            const y = adapter.getPriceToY(liqLockedPriceRef.current)
            if (typeof y === 'number' && Number.isFinite(y)) setLiqSelected((prev) => (prev ? { ...prev, y } : prev))
          }
        }),
      )

      const unsubCrosshair = adapter.subscribeCrosshairMove(
        safe((param: any) => {
          if (!showLiqOverlayRef.current) return
          try {
            const pt = param?.point
            const price = param?.price
            ;(window as any).__liqLastCrosshair = { ts: Date.now(), price: typeof price === 'number' ? price : null, y: typeof pt?.y === 'number' ? pt.y : null }
          } catch {}

      // ✅ 兜底：如果初次开启时拿不到可视价格区间（anchor 可能是 100），
      // 那就用第一次十字线回传的 price 作为锚点重建清算地图数据，确保能“立刻看到效果”。
      if ((!liqDataRef.current || liqCurrentPriceRef.current <= 0) && typeof param?.price === 'number' && Number.isFinite(param.price)) {
        const anchor = param.price
        liqCurrentPriceRef.current = anchor
        const symUpper = String(symbol || 'BTCUSDT').toUpperCase()
        let base = symUpper
        for (const q of ['USDT', 'USD', 'PERP', 'SWAP']) {
          if (base.endsWith(q)) base = base.slice(0, -q.length)
        }
        base = base || symUpper.slice(0, 3) || 'BTC'
        const d = generateLiquidationMapMockData(base, '1d', 'All', anchor, 200)
        setLiqData(d)
        try {
          if (typeof chart?.createMultipointShape === 'function') buildAndDrawLiqMap(d)
        } catch {
          // ignore
        }
      }

      const pt = param?.point
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return

      const containerW = containerEl.clientWidth
      const containerH = containerEl.clientHeight
      const rightScaleW = 72
      const overlayW = 260
      const bottomPad = 24
      const paneH = mainPaneHeightRef.current ?? (containerH - bottomPad)
      const x1 = containerW - rightScaleW - overlayW
      const x2 = containerW - rightScaleW
      const y2 = paneH

      if (liqLockedRef.current) {
        const lockedPrice = liqLockedPriceRef.current
        if (lockedPrice == null) return
        const y = adapter.getPriceToY(lockedPrice)
        if (typeof y === 'number' && Number.isFinite(y)) setLiqSelected((prev) => (prev ? { ...prev, y } : prev))
        return
      }

      if (pt.x < x1 || pt.x > x2 || pt.y < 0 || pt.y > y2) {
        setLiqSelected(null)
        return
      }

      const p = adapter.getYToPrice(pt.y)
      if (typeof p !== 'number' || !Number.isFinite(p)) return

      const price = p

      const s = liqSeriesRef.current
      if (!s) return

      const bybit = Math.max(0, interpolateByPrice(s.xs, s.bybit, price))
      const okx = Math.max(0, interpolateByPrice(s.xs, s.okx, price))
      const binance = Math.max(0, interpolateByPrice(s.xs, s.binance, price))
      const dex = Math.max(0, interpolateByPrice(s.xs, s.dex, price))
      const cumLong = Math.max(0, interpolateByPrice(s.xs, s.cumLong, price))
      const cumShort = Math.max(0, interpolateByPrice(s.xs, s.cumShort, price))

      setLiqSelected({
        locked: false,
        x: pt.x,
        y: pt.y,
        price,
        bybit: Number(bybit.toFixed(2)),
        okx: Number(okx.toFixed(2)),
        binance: Number(binance.toFixed(2)),
        dex: Number(dex.toFixed(2)),
        cumLong: Number(cumLong.toFixed(2)),
        cumShort: Number(cumShort.toFixed(2)),
      })
        }),
      )

      // === 鼠标 hover（无需点击）：在清算地图区域悬停直接展示 tooltip ===
      // 说明：TradingView 的 crossHairMoved 在部分区域（尤其右侧价格轴附近/图形覆盖层）不会触发，
      // 但你的交互期望是“鼠标放上去就出信息”。因此这里补一个 iframe 内的 pointermove。
      let hoverMoveCleanup: null | (() => void) = null
      try {
        const iframe = containerEl.querySelector('iframe') as HTMLIFrameElement | null
        const doc = iframe?.contentDocument
        if (iframe && doc) {
          const onMove = (ev: PointerEvent) => {
            try {
              if (!showLiqOverlayRef.current) return
              // locked 状态由 click 控制：锁定时 hover 不更新（只更新 y 由 chartChange 处理）
              if (liqLockedRef.current) return

              const containerRect = containerEl.getBoundingClientRect()
              const iframeRect = iframe.getBoundingClientRect()
              const x = ev.clientX + iframeRect.left - containerRect.left
              const y = ev.clientY + iframeRect.top - containerRect.top

              const containerW = containerEl.clientWidth
              const containerH = containerEl.clientHeight
              const rightScaleW = 72
              const overlayW = 260
              const bottomPad = 24
              const paneH = mainPaneHeightRef.current ?? (containerH - bottomPad)
              const x1 = containerW - rightScaleW - overlayW
              const x2 = containerW - rightScaleW
              const y2 = paneH

              // 不在清算地图区域：清掉 hover tooltip
              if (x < x1 || x > x2 || y < 0 || y > y2) {
                if (!liqLockedRef.current) setLiqSelected(null)
                removeLiqHoverLine()
                return
              }

              const p = adapter.getYToPrice(y)
              if (typeof p !== 'number' || !Number.isFinite(p)) return
              const price = p
              upsertLiqHoverLine(price)

              const s = liqSeriesRef.current
              if (!s) return

              const bybit = Math.max(0, interpolateByPrice(s.xs, s.bybit, price))
              const okx = Math.max(0, interpolateByPrice(s.xs, s.okx, price))
              const binance = Math.max(0, interpolateByPrice(s.xs, s.binance, price))
              const dex = Math.max(0, interpolateByPrice(s.xs, s.dex, price))
              const cumLong = Math.max(0, interpolateByPrice(s.xs, s.cumLong, price))
              const cumShort = Math.max(0, interpolateByPrice(s.xs, s.cumShort, price))

              setLiqSelected({
                locked: false,
                x,
                y,
                price,
                bybit: Number(bybit.toFixed(2)),
                okx: Number(okx.toFixed(2)),
                binance: Number(binance.toFixed(2)),
                dex: Number(dex.toFixed(2)),
                cumLong: Number(cumLong.toFixed(2)),
                cumShort: Number(cumShort.toFixed(2)),
              })
            } catch {
              // ignore
            }
          }

          doc.addEventListener('pointermove', onMove, { capture: true })
          hoverMoveCleanup = () => {
            try {
              doc.removeEventListener('pointermove', onMove as any, { capture: true } as any)
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }

      const unsubClick = adapter.subscribeClick(
        safe((param: any) => {
          if (!showLiqOverlayRef.current) return
          const pt = param?.point
          if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return

      const containerW = containerEl.clientWidth
      const containerH = containerEl.clientHeight
      const rightScaleW = 72
      const overlayW = 260
      const bottomPad = 24
      const paneH = mainPaneHeightRef.current ?? (containerH - bottomPad)
      const x1 = containerW - rightScaleW - overlayW
      const x2 = containerW - rightScaleW
      const y2 = paneH
      const inOverlay = pt.x >= x1 && pt.x <= x2 && pt.y >= 0 && pt.y <= y2

      if (!inOverlay) {
        if (liqLockedRef.current) {
          liqLockedRef.current = false
          liqLockedPriceRef.current = null
          setLiqSelected(null)
          refreshOverlay()
        }
        return
      }

      // Toggle lock
      if (liqLockedRef.current) {
        liqLockedRef.current = false
        liqLockedPriceRef.current = null
        setLiqSelected(null)
        refreshOverlay()
        return
      }

      const p = adapter.getYToPrice(pt.y)
      if (typeof p !== 'number' || !Number.isFinite(p)) return
      const price = p

      const s = liqSeriesRef.current
      if (!s) return

      const bybit = Math.max(0, interpolateByPrice(s.xs, s.bybit, price))
      const okx = Math.max(0, interpolateByPrice(s.xs, s.okx, price))
      const binance = Math.max(0, interpolateByPrice(s.xs, s.binance, price))
      const dex = Math.max(0, interpolateByPrice(s.xs, s.dex, price))
      const cumLong = Math.max(0, interpolateByPrice(s.xs, s.cumLong, price))
      const cumShort = Math.max(0, interpolateByPrice(s.xs, s.cumShort, price))

      liqLockedRef.current = true
      liqLockedPriceRef.current = price
      setLiqSelected({
        locked: true,
        x: pt.x,
        y: pt.y,
        price,
        bybit: Number(bybit.toFixed(2)),
        okx: Number(okx.toFixed(2)),
        binance: Number(binance.toFixed(2)),
        dex: Number(dex.toFixed(2)),
        cumLong: Number(cumLong.toFixed(2)),
        cumShort: Number(cumShort.toFixed(2)),
      })
      refreshOverlay()
        }),
      )

      cleanup = () => {
        unsubChart()
        unsubCrosshair()
        unsubClick()
        hoverMoveCleanup?.()
        hoverMoveCleanup = null
        chartAdapterRef.current = null
        if (paneSizeTimer) clearInterval(paneSizeTimer)
        if (drawingsGcTimer) clearInterval(drawingsGcTimer)
        if (drawingsSyncTimer) clearTimeout(drawingsSyncTimer)
        if (legendStudyTimer) clearInterval(legendStudyTimer)
        // legend ui handler 清理
        try {
          _legendUiCleanup?.()
        } catch {
          // ignore
        }
        // 不要在 cleanup 强制 removeAllLiqDrawings()：
        // - showLiqOverlay=false 分支会主动清理
        // - rebuild widget/unmount 时，widget.remove() 会清理所有实体
      }
    } catch (e) {
      console.warn('[liq-overlay] setup failed', e)
    }

    return () => {
      cleanup?.()
      cleanup = null
    }
  }, [isReady, isChartReady, showLiqOverlay, symbol])

  useEffect(() => {
    if (!liqData) {
      liqSeriesRef.current = null
      return
    }
    const xs = liqData.labels.map(parsePriceLabel)
    if (xs.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      liqSeriesRef.current = {
        xs: xs as number[],
        bybit: liqData.bybit,
        okx: liqData.okx,
        binance: liqData.binance,
        dex: liqData.dex,
        cumLong: liqData.cumulativeLong.map((v) => (typeof v === 'number' ? v : 0)),
        cumShort: liqData.cumulativeShort.map((v) => (typeof v === 'number' ? v : 0)),
      }
    } else {
      liqSeriesRef.current = null
    }
  }, [liqData])


  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} id={containerId} className="h-full w-full" />

      {/* 清算地图 overlay（右侧堆叠条/累积曲线，对齐价格轴） */}
      {/* Fallback：
          - build 不支持 native drawings：走 ECharts overlay
          - build 支持但没成功画出任何矩形：也走 overlay，避免“空白不显示” */}
      {showLiqOverlay && !liqHidden && liqData && (!liqNativeSupported || !liqNativeActive) && (
        <div
          className="pointer-events-none absolute z-[100]"
          style={{
            top: 0,
            right: 72,
            width: 260,
            height: typeof mainPaneHeight === 'number' && Number.isFinite(mainPaneHeight) && mainPaneHeight > 0 ? mainPaneHeight : undefined,
            bottom: typeof mainPaneHeight === 'number' && Number.isFinite(mainPaneHeight) && mainPaneHeight > 0 ? undefined : 24,
            opacity: 0.85,
          }}
        >
          <LiquidationMapChart
            ref={overlayRef as any}
            mode="overlay"
            data={liqData}
            currentPrice={liqCurrentPriceRef.current || 0}
            overlayWidth={260}
            overlayOpacity={0.85}
            selectedPrice={liqSelected?.price ?? null}
            getPriceToY={(p) => {
              try {
                return chartAdapterRef.current?.getPriceToY(p) ?? null
              } catch {
                return null
              }
            }}
          />
        </div>
      )}

      {/* 清算地图 tooltip（hover/click lock） */}
      {showLiqOverlay && !liqHidden && liqSelected && (
        <div
          className="pointer-events-none absolute z-[101] w-[260px]"
          style={{
            right: 80,
            top: clamp(
              liqSelected.y - 64,
              8,
              (typeof mainPaneHeight === 'number' && Number.isFinite(mainPaneHeight) && mainPaneHeight > 0
                ? mainPaneHeight
                : (document.getElementById(containerId)?.clientHeight ?? 520)) - 170,
            ),
          }}
        >
          <div className="bg-[color:var(--cf-bg)]/85 border border-[color:var(--cf-border)] rounded-lg px-3 py-2 text-xs text-[color:var(--cf-text)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="font-bold">{t('chart.indicators.price')}: {liqSelected.price.toFixed(liqSelected.price >= 100 ? 2 : 4)}</div>
              {liqSelected.locked && <div className="text-[10px] text-[color:var(--cf-text-muted)]">{t('chart.indicators.locked')}</div>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#36b8c9' }} />
                  <span>Bybit</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.bybit)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#f7d05e' }} />
                  <span>OKX</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.okx)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#f08024' }} />
                  <span>Binance</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.binance)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#bf5af2' }} />
                  <span>DEX</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.dex)}</span>
              </div>
            </div>

            <div className="mt-2 border-t border-[color:var(--cf-border)] pt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                  <span>{t('chart.indicators.cumulativeLong')}</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.cumLong)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
                  <span>{t('chart.indicators.cumulativeShort')}</span>
                </div>
                <span className="font-bold">{formatUsdCompactFromMillions(liqSelected.cumShort)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading chart...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  )
})
