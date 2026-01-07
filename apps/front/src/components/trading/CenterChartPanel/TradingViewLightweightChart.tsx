'use client';

import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { LiquidationMapChartHandle } from '@/components/liquidation-map/LiquidationMapChart'
import type { ChartAdapter } from '@/components/trading/chart-adapter/chart-adapter'
import { AreaSeries, CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, LineSeries } from 'lightweight-charts'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { createLightweightChartAdapter } from '@/components/trading/chart-adapter/lightweight-chart-adapter'
import { generateLiquidationMapMockData } from '@/lib/liquidation-map/mock-liquidation-map'
import { getMockBasePrice, getMockVolatility } from '@/lib/mock/market'

// ---- Helper Components ----

const IndicatorPanelHeader = ({
  title,
  value,
  valueColor,
  valueParts,
}: {
  title: string
  value?: string
  valueColor?: string
  valueParts?: Array<{ text: string; color?: string }>
}) => (
  <div className="flex items-center gap-2 h-[16px] px-1 absolute top-[5px] left-1 z-10 pointer-events-none bg-[#161b22] rounded-sm">
    <span className="text-[10px] text-[#8b949e] font-roboto font-normal leading-4 tracking-tight truncate">
      {title}
    </span>
    {Array.isArray(valueParts) && valueParts.length > 0 ? (
      <span className="text-[10px] font-roboto font-normal leading-4 tracking-tight whitespace-pre">
        {valueParts.map((p, idx) => (
          <span key={idx} style={{ color: p.color || '#c9d1d9' }}>
            {p.text}
          </span>
        ))}
      </span>
    ) : value ? (
      <span
        className="text-[10px] font-roboto font-normal leading-4 tracking-tight"
        style={{ color: valueColor || '#c9d1d9' }}
      >
        {value}
      </span>
    ) : null}
  </div>
)

interface IndicatorChartProps {
  id: string
  title: string
  color: string
  height?: number
  data: any[]
  type: 'line' | 'area' | 'bar' | 'liquidation'
  mainChart: IChartApi | null
  registerChart: (id: string, chart: IChartApi) => void
  unregisterChart?: (id: string) => void
  onClose?: () => void
  showTvLogo?: boolean
  formatter?: (val: number) => string
  priceFormatter?: (val: number) => string
}

const IndicatorChartPanel = ({
  id,
  title,
  color,
  height = 70,
  data,
  type,
  mainChart: _mainChart,
  registerChart,
  unregisterChart,
  onClose,
  showTvLogo = false,
  formatter,
  priceFormatter,
}: IndicatorChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<any> | null>(null)
  const altSeriesRef = useRef<ISeriesApi<any> | null>(null)
  const dataByTimeRef = useRef<Map<string, any>>(new Map())
  const [currentValue, setCurrentValue] = useState<string>('')
  const [currentValueColor, setCurrentValueColor] = useState<string>('')
  const [liqHeader, setLiqHeader] = useState<null | { longUsd: number; shortUsd: number; totalUsd: number }>(null)
  const [axisLabels, setAxisLabels] = useState<{ top: string; mid: string; bottom: string }>({ top: '', mid: '', bottom: '' })

  const localFormatAxis = (v: number) => {
    if (priceFormatter)
      return priceFormatter(v)
    if (type === 'line')
      return Number(v).toFixed(2)
    return formatCompactNumber(v)
  }
  
  // Init chart
  useEffect(() => {
    if (!containerRef.current) return

    const hasPerPointColor = type === 'line' && data.some((d) => d && typeof d.color === 'string')

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      ...(priceFormatter ? { localization: { priceFormatter } } : {}),
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor: '#8b949e',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#30363d', style: 2 },
      },
      rightPriceScale: {
        borderColor: '#30363d',
        visible: true,
        // Hide built-in ticks; we overlay our own fixed 3 labels
        ticksVisible: false,
        borderVisible: true,
        entireTextOnly: true,
        minimumWidth: 72, // keep aligned with main K-line price scale width
        scaleMargins: { top: 0.25, bottom: 0.1 },
      },
      timeScale: {
        visible: false, // Hide time scale, sync with main
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: true, labelVisible: false, color: '#30363d', style: 2 },
        // Keep price label on the right (click/hover shows amount)
        horzLine: { visible: false, labelVisible: true },
      },
      handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false }, // Disable own scaling
      handleScroll: { mouseWheel: false, pressedMouseMove: false }, // Disable own scrolling
    })

    let series: ISeriesApi<any>
    if (type === 'line') {
      // For segmented red/green lines (e.g. LS ratio), render two line series with whitespace gaps.
      if (hasPerPointColor) {
        const bull = chart.addSeries(LineSeries, {
          color: '#22c55e',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        const bear = chart.addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        series = bull
        altSeriesRef.current = bear
      } else {
        series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          ...(priceFormatter
            ? { priceFormat: { type: 'custom', minMove: 0.0001, formatter: priceFormatter } }
            : {}),
        })
      }
    } else if (type === 'area') {
      // Filled area to bottom (Coinglass-like OI panel)
      series = chart.addSeries(AreaSeries, {
        lineColor: color,
        lineWidth: 2,
        topColor: `${color}55`, // ~33% opacity
        bottomColor: `${color}00`, // fade to transparent at bottom
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        ...(priceFormatter
          ? { priceFormat: { type: 'custom', minMove: 1, formatter: priceFormatter } }
          : {}),
      })
    } else if (type === 'liquidation') {
      // Dual histogram around 0:
      // - short liquidation: +value above 0 (green)
      // - long liquidation:  -value below 0 (red)
      const shortSeries = chart.addSeries(HistogramSeries, {
        color: '#22c55e',
        ...(priceFormatter
          ? { priceFormat: { type: 'custom', minMove: 1, formatter: priceFormatter } }
          : { priceFormat: { type: 'volume' } }),
        priceLineVisible: false,
        lastValueVisible: false,
      })
      const longSeries = chart.addSeries(HistogramSeries, {
        color: '#ef4444',
        ...(priceFormatter
          ? { priceFormat: { type: 'custom', minMove: 1, formatter: priceFormatter } }
          : { priceFormat: { type: 'volume' } }),
        priceLineVisible: false,
        lastValueVisible: false,
      })
      series = shortSeries
      altSeriesRef.current = longSeries
    } else {
      series = chart.addSeries(HistogramSeries, {
        color,
        ...(priceFormatter
          ? { priceFormat: { type: 'custom', minMove: 1, formatter: priceFormatter } }
          : { priceFormat: { type: 'volume' } }),
        priceLineVisible: false,
        lastValueVisible: false,
      })
    }
    
    // Store data for legend lookup (crosshair move)
    dataByTimeRef.current = new Map(data.map((d) => [String(d?.time), d]))

    // Set series data (support segmented line via whitespace gaps)
    if (type === 'line' && hasPerPointColor && altSeriesRef.current) {
      // Build segmented lines by inserting a single whitespace point ONLY on trend switch.
      // This avoids the "flat horizontal line" artifact caused by dense whitespace points.
      const bullData: any[] = []
      const bearData: any[] = []
      let prevBull: boolean | null = null
      for (const d of data) {
        if (!d || typeof d.value !== 'number') continue
        const isBull = d.value >= 1
        if (isBull) {
          bullData.push({ time: d.time, value: d.value })
          if (prevBull === false) bearData.push({ time: d.time }) // break bear
        } else {
          bearData.push({ time: d.time, value: d.value })
          if (prevBull === true) bullData.push({ time: d.time }) // break bull
        }
        prevBull = isBull
      }
      series.setData(bullData as any)
      altSeriesRef.current.setData(bearData as any)
    } else if (type === 'liquidation' && altSeriesRef.current) {
      const shortData = data
        .filter((d) => d && typeof d.shortLiquidationUsd === 'number')
        .map((d) => ({ time: d.time, value: d.shortLiquidationUsd, color: '#22c55e' }))
      const longData = data
        .filter((d) => d && typeof d.longLiquidationUsd === 'number')
        .map((d) => ({ time: d.time, value: -d.longLiquidationUsd, color: '#ef4444' }))
      series.setData(shortData as any)
      altSeriesRef.current.setData(longData as any)
    } else {
      series.setData(data)
    }
    chartRef.current = chart
    seriesRef.current = series
    registerChart(id, chart)

    // Set initial value (last point)
    if (data.length > 0) {
      const last = data[data.length - 1]
      if (type === 'liquidation') {
        const longUsd = typeof last?.longLiquidationUsd === 'number' ? last.longLiquidationUsd : 0
        const shortUsd = typeof last?.shortLiquidationUsd === 'number' ? last.shortLiquidationUsd : 0
        const totalUsd = longUsd + shortUsd
        setLiqHeader({ longUsd, shortUsd, totalUsd })
        setCurrentValue('')
        setCurrentValueColor('#c9d1d9')
      } else {
        setLiqHeader(null)
        const val = last.value
        setCurrentValue(formatter ? formatter(val) : String(val))
        // Prefer explicit data color (for segmented coloring), fallback to series color
        setCurrentValueColor(typeof last?.color === 'string' ? last.color : color)
      }
    }

    // Subscribe to crosshair to update legend value
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const d = dataByTimeRef.current.get(String(param.time))
        if (d) {
          if (type === 'liquidation') {
            const longUsd = typeof d?.longLiquidationUsd === 'number' ? d.longLiquidationUsd : 0
            const shortUsd = typeof d?.shortLiquidationUsd === 'number' ? d.shortLiquidationUsd : 0
            const totalUsd = longUsd + shortUsd
            setLiqHeader({ longUsd, shortUsd, totalUsd })
            setCurrentValue('')
            setCurrentValueColor('#c9d1d9')
          } else {
            setLiqHeader(null)
            const val = d.value
            setCurrentValue(formatter ? formatter(val) : String(val))
            setCurrentValueColor(typeof d?.color === 'string' ? d.color : color)
          }
        }
      } else {
        // Reset to last value
        if (data.length > 0) {
          const last = data[data.length - 1]
          if (type === 'liquidation') {
            const longUsd = typeof last?.longLiquidationUsd === 'number' ? last.longLiquidationUsd : 0
            const shortUsd = typeof last?.shortLiquidationUsd === 'number' ? last.shortLiquidationUsd : 0
            const totalUsd = longUsd + shortUsd
            setLiqHeader({ longUsd, shortUsd, totalUsd })
            setCurrentValue('')
            setCurrentValueColor('#c9d1d9')
          } else {
            setLiqHeader(null)
            const val = last.value
            setCurrentValue(formatter ? formatter(val) : String(val))
            setCurrentValueColor(typeof last?.color === 'string' ? last.color : color)
          }
        }
      }
    })

    const handleResize = () => {
       if (containerRef.current && chart) {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          if (w > 0 && h > 0) {
             chart.applyOptions({ width: w, height: h })
             // Force a repaint logic check
             chart.timeScale().fitContent()
          }
       }
    }

    const resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(handleResize)
    })
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    
    window.requestAnimationFrame(handleResize)

    return () => {
      resizeObserver.disconnect()
      try {
        unregisterChart?.(id)
      } catch {
        // ignore
      }
      altSeriesRef.current = null
      chart.remove()
    }
  }, []) // Init once

  // Update data when props change
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      // refresh lookup
      dataByTimeRef.current = new Map(data.map((d) => [String(d?.time), d]))

      const hasPerPointColor = type === 'line' && data.some((d) => d && typeof d.color === 'string') && altSeriesRef.current
      if (hasPerPointColor) {
        const bullData: any[] = []
        const bearData: any[] = []
        let prevBull: boolean | null = null
        for (const d of data) {
          if (!d || typeof d.value !== 'number') continue
          const isBull = d.value >= 1
          if (isBull) {
            bullData.push({ time: d.time, value: d.value })
            if (prevBull === false) bearData.push({ time: d.time })
          } else {
            bearData.push({ time: d.time, value: d.value })
            if (prevBull === true) bullData.push({ time: d.time })
          }
          prevBull = isBull
        }
        seriesRef.current.setData(bullData as any)
        altSeriesRef.current!.setData(bearData as any)
      } else if (type === 'liquidation' && altSeriesRef.current) {
        const shortData = data
          .filter((d) => d && typeof d.shortLiquidationUsd === 'number')
          .map((d) => ({ time: d.time, value: d.shortLiquidationUsd, color: '#22c55e' }))
        const longData = data
          .filter((d) => d && typeof d.longLiquidationUsd === 'number')
          .map((d) => ({ time: d.time, value: -d.longLiquidationUsd, color: '#ef4444' }))
        seriesRef.current.setData(shortData as any)
        altSeriesRef.current.setData(longData as any)
      } else {
        seriesRef.current.setData(data)
      }
       // Update header value
       const last = data[data.length - 1]
       if (type === 'liquidation') {
         const longUsd = typeof last?.longLiquidationUsd === 'number' ? last.longLiquidationUsd : 0
         const shortUsd = typeof last?.shortLiquidationUsd === 'number' ? last.shortLiquidationUsd : 0
         const totalUsd = longUsd + shortUsd
         setLiqHeader({ longUsd, shortUsd, totalUsd })
         setCurrentValue('')
         setCurrentValueColor('#c9d1d9')
       } else {
         setLiqHeader(null)
         const val = last.value
         setCurrentValue(formatter ? formatter(val) : String(val))
         setCurrentValueColor(typeof last?.color === 'string' ? last.color : color)
       }
       
       if (chartRef.current) {
           chartRef.current.timeScale().fitContent()
       }
    }
  }, [data])

  // Fixed 3-axis labels (top/mid/bottom) based on current data range
  useEffect(() => {
    if (!data || data.length === 0) {
      setAxisLabels({ top: '', mid: '', bottom: '' })
      return
    }

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    if (type === 'liquidation') {
      for (const d of data) {
        const longUsd = typeof d?.longLiquidationUsd === 'number' ? d.longLiquidationUsd : 0
        const shortUsd = typeof d?.shortLiquidationUsd === 'number' ? d.shortLiquidationUsd : 0
        min = Math.min(min, -longUsd)
        max = Math.max(max, shortUsd)
      }
    } else {
      for (const d of data) {
        if (d && typeof d.value === 'number') {
          min = Math.min(min, d.value)
          max = Math.max(max, d.value)
        }
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      setAxisLabels({ top: '', mid: '', bottom: '' })
      return
    }

    if (min === max) {
      const pad = Math.abs(min) * 0.1 || 1
      min -= pad
      max += pad
    }

    const mid = min < 0 && max > 0 ? 0 : (min + max) / 2

    setAxisLabels({
      top: localFormatAxis(max),
      mid: localFormatAxis(mid),
      bottom: localFormatAxis(min),
    })
  }, [data, type])

  return (
    <div className={`flex flex-col w-full flex-shrink-0 ${showTvLogo ? '' : 'cf-hide-tv-logo'}`}>
       {/* Separator_Top strictly matching Figma structure */}
       <div className="h-[1px] w-full bg-[#30363d]" />
       <div className="relative w-full bg-[#161b22]" style={{ height }}>
          {/* Close button: move into plot area (left of price scale) to avoid covering Y-axis labels */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-[5px] right-[80px] z-20 pointer-events-auto w-4 h-4 flex items-center justify-center rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]"
              aria-label="close"
              title="关闭"
            >
              ×
            </button>
          )}
          <IndicatorPanelHeader
            title={title}
            value={currentValue}
            valueColor={currentValueColor}
            valueParts={
              type === 'liquidation' && liqHeader
                ? [
                    { text: `L ${formatUsdCompact(liqHeader.longUsd)}  `, color: '#ef4444' },
                    { text: `S ${formatUsdCompact(liqHeader.shortUsd)}  `, color: '#22c55e' },
                    { text: `T ${formatUsdCompact(liqHeader.totalUsd)}`, color: '#c9d1d9' },
                  ]
                : undefined
            }
          />
          {/* Chart host (includes internal price scale area); we overlay fixed 3 labels + dashed guides */}
          <div ref={containerRef} className="w-full h-full" />

          {/* Dashed guide lines for the 3 fixed ticks (do not extend into price scale area) */}
          <div className="pointer-events-none absolute left-0 right-[72px] top-[10px] border-t border-dashed border-[#30363d]/70" />
          <div className="pointer-events-none absolute left-0 right-[72px] top-1/2 -translate-y-1/2 border-t border-dashed border-[#30363d]/70" />
          <div className="pointer-events-none absolute left-0 right-[72px] bottom-[10px] border-t border-dashed border-[#30363d]/70" />

          {/* Custom fixed 3-tick labels (left-aligned) over the hidden built-in ticks */}
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-[72px] border-l border-[#30363d]">
            <div className="absolute top-1 left-2 text-[10px] text-[#8b949e] tabular-nums">{axisLabels.top}</div>
            <div className="absolute top-1/2 -translate-y-1/2 left-2 text-[10px] text-[#8b949e] tabular-nums">{axisLabels.mid}</div>
            <div className="absolute bottom-1 left-2 text-[10px] text-[#8b949e] tabular-nums">{axisLabels.bottom}</div>
          </div>
       </div>
    </div>
  )
}

function parsePriceLabel(label: string): number | null {
  const n = Number.parseFloat(String(label).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateByPrice(xs: number[], ys: number[], x: number): number {
  // xs must be sorted ascending.
  if (!xs.length) return 0
  if (x <= xs[0]) return ys[0] ?? 0
  const last = xs.length - 1
  if (x >= xs[last]) return ys[last] ?? 0

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

function pickOverlayPriceStep(currentPrice: number): number {
  // Keep consistent with LiquidationMapChart overlay densify defaults.
  if (currentPrice >= 10000) return 20
  if (currentPrice >= 1000) return 10
  if (currentPrice >= 100) return 1
  if (currentPrice >= 10) return 0.1
  return 0.01
}

function formatUsdCompactFromMillions(valueM: number): string {
  const v = typeof valueM === 'number' && Number.isFinite(valueM) ? valueM : 0
  // Match the "数据->清算地图" tooltip feel:
  // - Exchanges: show as integer M if < 1000M
  // - Large values: show as B with 2 decimals
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}B`
  return `$${Math.round(v)}M`
}

function formatCompactNumber(n: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  // Use stable compact notation (K/M/B) for axis ticks.
  // Keep US locale to guarantee K/M/B suffixes.
  const fmt = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })
  return fmt.format(v).toUpperCase()
}

function formatUsdCompact(n: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return `$${formatCompactNumber(v)}`
}

// (removed) formatTimeLabel: not needed since liquidation header no longer shows time

interface ActiveIndicator {
  id: string
  label: string
  kind: 'chartSeries' | 'chartOverlay'
  href?: string
}

export type DataSource = 'binance' | 'okx';
export type MarketType = 'futures' | 'spot';

interface PriceLineApi {
  applyOptions: (options: { price?: number; axisLabelVisible?: boolean }) => void
}

interface CandlestickSeriesApi {
  setData: (data: unknown[]) => void
  update: (bar: unknown) => void
  priceToCoordinate?: (price: number) => number | null
  coordinateToPrice?: (y: number) => number | null
  createPriceLine: (options: {
    price: number
    color: string
    lineWidth: number
    lineStyle: number
    axisLabelVisible: boolean
    title: string
  }) => PriceLineApi
}

interface SeriesApi {
  setData: (data: unknown[]) => void
}

interface CandleBar {
  time: unknown
  open: number
  high: number
  low: number
  close: number
}

export const TradingViewLightweightChart = ({
  symbol,
  interval,
  isAggregated,
  selectedExchange,
  marketType,
  activeIndicators = [],
  onRemoveIndicator,
}: {
  symbol: string
  interval: string
  isAggregated: boolean
  selectedExchange: DataSource
  marketType: MarketType
  activeIndicators?: ActiveIndicator[]
  onRemoveIndicator?: (id: string) => void
}) => {
  const { t } = useTranslation();
  const chartHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<LiquidationMapChartHandle | null>(null)
  const chartRef = useRef<any>(null);
  const chartAdapterRef = useRef<ChartAdapter | null>(null)
  const candlestickSeriesRef = useRef<CandlestickSeriesApi | null>(null)
  const lockedPriceLineRef = useRef<PriceLineApi | null>(null)
  const indicatorSeriesRef = useRef<Record<string, SeriesApi>>({})
  const activeIndicatorsRef = useRef<ActiveIndicator[]>([])
  const displayPriceRef = useRef<number>(0)
  const candleDataRef = useRef<CandleBar[]>([])
  const lastCandleRef = useRef<CandleBar | null>(null)
  const [isMounted, setIsMounted] = useState(false);
  const [ohlc, setOhlc] = useState<any>(null);
  const [lastCandleClose, setLastCandleClose] = useState<number | null>(null)
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
  const lastCandleCloseRef = useRef<number | null>(null)
  const liqDataRef = useRef<any>(null)
  const liqSeriesRef = useRef<null | {
    xs: number[]
    bybit: number[]
    okx: number[]
    binance: number[]
    dex: number[]
    cumLong: number[]
    cumShort: number[]
  }>(null)

  // New Refs and State for Sub-Charts Sync
  const subChartsRef = useRef<Record<string, IChartApi>>({})
  const [indicatorData, setIndicatorData] = useState<{
      ls: any[],
      oi: any[],
      vol: any[],
      liq: any[]
  }>({ ls: [], oi: [], vol: [], liq: [] })

  const registerChart = (id: string, chart: IChartApi) => {
    subChartsRef.current[id] = chart
    
    // One-way sync: Main Chart -> Sub Chart
    if (chartRef.current) {
        // Initial sync
        const range = chartRef.current.timeScale().getVisibleLogicalRange()
        if (range) {
           chart.timeScale().setVisibleLogicalRange(range)
        }
    }
  }

  const unregisterChart = (id: string) => {
    delete subChartsRef.current[id]
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    activeIndicatorsRef.current = activeIndicators
  }, [activeIndicators])

  useEffect(() => {
    lastCandleCloseRef.current = lastCandleClose
  }, [lastCandleClose])

  // ==== 唯一当前价数据源（必须）：与顶部显示价格同源 ====
  // 顶部 87010 来源目前是 displayPrice（逻辑与 TopBar.tsx 保持一致）。
  const basePriceForHeader = getMockBasePrice(symbol)
  const headerPrice = useMemo(() => {
    let price = basePriceForHeader
    if (!isAggregated) {
      if (selectedExchange === 'binance') price *= 1.0001
      else price *= 0.9999
    }
    if (marketType === 'spot') price *= 1.0005
    return price
  }, [basePriceForHeader, isAggregated, selectedExchange, marketType])
  const lockedPrice = headerPrice

  useEffect(() => {
    displayPriceRef.current = lockedPrice
  }, [lockedPrice])

  useEffect(() => {
    if (!isMounted || !chartHostRef.current) return;

    const container = chartHostRef.current;
    
    // 彻底清空容器
    container.innerHTML = '';

    // 创建图表实例 (v5 API) —— 只初始化一次（避免切周期时重建导致 priceLine 重建）
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#161b22' },
        horzLines: { color: '#161b22' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          labelBackgroundColor: '#1f2937',
          // 禁止十字线在右侧生成第二个价格标签
          labelVisible: false,
        },
        horzLine: {
          labelBackgroundColor: '#1f2937',
          // 禁止十字线在右侧生成第二个价格标签
          labelVisible: false,
        },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#30363d',
        visible: true,
        minimumWidth: 72,
      }
    });

    // 1. K线序列 (Main Series)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2ea043',
      downColor: '#da3633',
      borderVisible: false,
      wickUpColor: '#2ea043',
      wickDownColor: '#da3633',
      // Avoid a second "last value" price line; we own the single current price line via createPriceLine().
      priceLineVisible: false,
      // 禁止显示随周期变化的“最新价标签”（会变成错误的第二标签）
      lastValueVisible: false,
    });
    candlestickSeriesRef.current = candlestickSeries as unknown as CandlestickSeriesApi

    // ==== 唯一当前价线/标签：只创建一次并缓存 ====
    // 价格永远锁定为 headerPrice（顶部显示同源），不允许使用 lastCandle.close / crosshair price。
    if (!lockedPriceLineRef.current && typeof lockedPrice === 'number' && Number.isFinite(lockedPrice)) {
      lockedPriceLineRef.current = (candlestickSeries as unknown as CandlestickSeriesApi).createPriceLine({
        price: lockedPrice,
        color: 'rgba(255,80,80,0.95)',
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: '',
      })
      console.log('[LOCKED PRICE LINE CREATED]', lockedPrice)
    }

    // 初始化四个可选 chartSeries（仅创建一次；显示与否由 setData([]) 控制）
    // NOTE: 这样不会因为切换指标/周期而重建 chart，从而保证 priceLine 永远只有一条且不重建。
    indicatorSeriesRef.current = {
      'long-short-ratio': chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        priceScaleId: 'ls',
      }) as unknown as SeriesApi,
      'aggregated-open-interest': chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        priceScaleId: 'oi',
      }) as unknown as SeriesApi,
      'aggregated-volume': chart.addSeries(HistogramSeries, {
        color: '#ec4899',
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      }) as unknown as SeriesApi,
      'liquidation-data': chart.addSeries(HistogramSeries, {
        color: '#ef4444',
        priceFormat: { type: 'volume' },
        priceScaleId: 'liq',
      }) as unknown as SeriesApi,
    }

    // Apply scale margins (best-effort)
    try { ;(chart as any).priceScale('ls')?.applyOptions?.({ scaleMargins: { top: 0.15, bottom: 0.55 } }) } catch {}
    try { ;(chart as any).priceScale('oi')?.applyOptions?.({ scaleMargins: { top: 0.35, bottom: 0.35 } }) } catch {}
    try { ;(chart as any).priceScale('vol')?.applyOptions?.({ scaleMargins: { top: 0.8, bottom: 0 } }) } catch {}
    try { ;(chart as any).priceScale('liq')?.applyOptions?.({ scaleMargins: { top: 0.8, bottom: 0 } }) } catch {}

    // Build chart adapter for liquidation overlay (centralize all Lightweight calls).
    chartAdapterRef.current = createLightweightChartAdapter({
      chart: chart as any,
      mainSeries: candlestickSeries as any,
      priceScaleId: 'right',
      getCurrentPrice: () => displayPriceRef.current,
    })

    chartRef.current = chart;
    chartRef.current = chart;

    // NOTE: Price<->pixel mapping is provided by chartAdapterRef (no direct Lightweight calls here).

    const isLiqOverlayActive = () => activeIndicatorsRef.current.some((x) => x.id === 'liquidation-map')
    const chartAdapter = chartAdapterRef.current
    // 订阅十字线移动事件 (also drives hover tooltip)
    const onCrosshairMove = (param: any) => {
      if (param.time) {
        const data = param.seriesData.get(candlestickSeries);
        if (data) {
          setOhlc(data);
        }
      } else {
        if (lastCandleRef.current) setOhlc(lastCandleRef.current)
      }

      // Hover tooltip for liquidation overlay (does NOT block Lightweight interactions)
      if (!isLiqOverlayActive()) return
      if (!chartAdapter) return
      if (liqLockedRef.current) {
        // Locked: keep updating position to follow pan/zoom
        const lockedPrice = liqLockedPriceRef.current
        if (lockedPrice == null) return
        const _pt = param?.point
        const y = chartAdapter.getPriceToY(lockedPrice)
        if (typeof y !== 'number' || !Number.isFinite(y)) return
        setLiqSelected((prev) => {
          if (!prev) return prev
          return { ...prev, y }
        })
        return
      }

      const pt = param?.point
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return
      const containerW = container.clientWidth
      const containerH = container.clientHeight
      const rightScaleW = 72
      const overlayW = 260
      const bottomPad = 24
      const x1 = containerW - rightScaleW - overlayW
      const x2 = containerW - rightScaleW
      const y2 = containerH - bottomPad
      if (pt.x < x1 || pt.x > x2 || pt.y < 0 || pt.y > y2) {
        setLiqSelected(null)
        return
      }

      // Sample by y -> price -> interpolate liquidation data
      const p = chartAdapter.getYToPrice(pt.y)
      if (typeof p !== 'number' || !Number.isFinite(p)) return

      // Snap to the same step used by overlay densify, so highlight aligns with bars
      const step = pickOverlayPriceStep(typeof lastCandleCloseRef.current === 'number' ? lastCandleCloseRef.current : basePriceForHeader)
      const price = Math.round(p / step) * step

      // Interpolate on raw series (same fields as "数据->清算地图")
      const s = liqSeriesRef.current
      if (!s) return
      const bybit = Math.max(0, interpolateByPrice(s.xs, s.bybit, price))
      const okx = Math.max(0, interpolateByPrice(s.xs, s.okx, price))
      const binance = Math.max(0, interpolateByPrice(s.xs, s.binance, price))
      const dex = Math.max(0, interpolateByPrice(s.xs, s.dex, price))
      const cumLong = Math.max(0, interpolateByPrice(s.xs, s.cumLong, price))
      const cumShort = Math.max(0, interpolateByPrice(s.xs, s.cumShort, price))
      const _total = bybit + okx + binance + dex

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
    }
    const unsubCrosshair = chartAdapter?.subscribeCrosshairMove(onCrosshairMove) ?? (() => {})

    // Keep overlay y alignment in sync on pan/zoom.
    function refreshOverlay() {
      overlayRef.current?.refresh()
      // If tooltip is locked, re-position it by price (y changes with zoom/pan)
      if (liqLockedRef.current && liqLockedPriceRef.current != null) {
        const y = chartAdapter?.getPriceToY(liqLockedPriceRef.current)
        if (typeof y === 'number' && Number.isFinite(y)) {
          setLiqSelected((prev) => (prev ? { ...prev, y } : prev))
        }
      }
    }

    // Click-to-inspect (toggle lock): pick by clicked y coordinate, but only when clicking inside overlay band.
    const onChartClick = (param: any) => {
      try {
        // If overlay is not active, ignore clicks (and clear any stale lock).
        if (!isLiqOverlayActive()) {
          if (liqLockedRef.current) {
            liqLockedRef.current = false
            liqLockedPriceRef.current = null
            setLiqSelected(null)
            refreshOverlay()
          }
          return
        }
        if (!chartAdapter) return

        const pt = param?.point
        if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return
        const containerW = container.clientWidth
        const containerH = container.clientHeight
        const rightScaleW = 72
        const overlayW = 260
        const bottomPad = 24
        const x1 = containerW - rightScaleW - overlayW
        const x2 = containerW - rightScaleW
        const y2 = containerH - bottomPad
        const inOverlay = pt.x >= x1 && pt.x <= x2 && pt.y >= 0 && pt.y <= y2

        if (!inOverlay) {
          // Clicking elsewhere: unlock if locked
          if (liqLockedRef.current) {
            liqLockedRef.current = false
            liqLockedPriceRef.current = null
            setLiqSelected(null)
            refreshOverlay()
          }
          return
        }

        // If already locked -> unlock on any click inside overlay
        if (liqLockedRef.current) {
          liqLockedRef.current = false
          liqLockedPriceRef.current = null
          setLiqSelected(null)
          refreshOverlay()
          return
        }

        const p = chartAdapter.getYToPrice(pt.y)
        if (typeof p !== 'number' || !Number.isFinite(p)) return
        const step = pickOverlayPriceStep(typeof lastCandleCloseRef.current === 'number' ? lastCandleCloseRef.current : basePrice)
        const price = Math.round(p / step) * step

        const s = liqSeriesRef.current
        if (!s) return
        const bybit = Math.max(0, interpolateByPrice(s.xs, s.bybit, price))
        const okx = Math.max(0, interpolateByPrice(s.xs, s.okx, price))
        const binance = Math.max(0, interpolateByPrice(s.xs, s.binance, price))
        const dex = Math.max(0, interpolateByPrice(s.xs, s.dex, price))
        const cumLong = Math.max(0, interpolateByPrice(s.xs, s.cumLong, price))
        const cumShort = Math.max(0, interpolateByPrice(s.xs, s.cumShort, price))
        const _total = bybit + okx + binance + dex

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
      } catch {
        // ignore
      }
    }
    const unsubClick = chartAdapter?.subscribeClick(onChartClick) ?? (() => {})

    const handleResize = () => {
      if (chart && container) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
        refreshOverlay()
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Sync main chart visible range -> all indicator sub-charts (subscribe once per chart instance)
    const timeScale = chart.timeScale()
    const syncVisibleRange = (range: any) => {
      if (!range) return
      Object.values(subChartsRef.current).forEach((sub) => {
        try {
          sub.timeScale().setVisibleLogicalRange(range)
        } catch {
          // ignore
        }
      })
    }
    timeScale.subscribeVisibleLogicalRangeChange(syncVisibleRange)
    // Initial sync (best effort)
    try {
      const range = timeScale.getVisibleLogicalRange()
      if (range) syncVisibleRange(range)
    } catch {
      // ignore
    }

    const unsubChartChange = chartAdapter?.subscribeChartChange(refreshOverlay) ?? (() => {})
    // Initial sync (chartRef is now ready)
    refreshOverlay()

    return () => {
      resizeObserver.disconnect();
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(syncVisibleRange)
      } catch {
        // ignore
      }
      unsubChartChange()
      unsubCrosshair()
      unsubClick()
      chart.remove();
      chartRef.current = null;
      chartAdapterRef.current = null
      candlestickSeriesRef.current = null
      lockedPriceLineRef.current = null
      indicatorSeriesRef.current = {}
    };
  }, [isMounted, symbol]);

  const baseAsset = symbol.replace(/USDT|USD|PERP|SWAP|[-_]/gi, '').slice(0, 5) || 'BTC'

  // 顶部价格更新时，只允许 applyOptions 更新 price（禁止创建第二条线）
  useEffect(() => {
    if (typeof lockedPrice !== 'number' || !Number.isFinite(lockedPrice)) return
    if (!lockedPriceLineRef.current) return
    lockedPriceLineRef.current.applyOptions({ price: lockedPrice, axisLabelVisible: true })
    console.log('[LOCKED PRICE LINE UPDATED]', lockedPrice)
  }, [lockedPrice])

  // 切换周期/切换指标时：只更新 K 线数据与指标数据，不重建 chart（从而保证 priceLine 不会被重建）
  useEffect(() => {
    if (!isMounted) return
    const candleSeries = candlestickSeriesRef.current
    const chartApi: any = chartRef.current
    if (!candleSeries || !chartApi) return

    const now = Math.floor(Date.now() / 1000)
    const stepMap: Record<string, number> = {
      '1s': 1,
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    }
    const step = stepMap[interval] ?? 900
    const basePrice = getMockBasePrice(symbol)
    const vol = getMockVolatility(basePrice)

    const round = (n: number) => {
      if (basePrice >= 1000) return Number(n.toFixed(1))
      if (basePrice >= 1) return Number(n.toFixed(4))
      return Number(n.toFixed(6))
    }

    const candleData: CandleBar[] = []
    let lastClose = basePrice
    for (let i = 0; i < 300; i++) {
      const time = now - (300 - i) * step
      const open = lastClose + (Math.random() - 0.5) * vol
      const high = open + Math.random() * (vol * 0.8)
      const low = open - Math.random() * (vol * 0.8)
      const close = low + Math.random() * (high - low)
      const candle: CandleBar = {
        time: time as unknown,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
      }
      candleData.push(candle)
      lastClose = close
    }

    candleDataRef.current = candleData
    lastCandleRef.current = candleData[candleData.length - 1] ?? null
    candleSeries.setData(candleData as unknown[])

    if (lastCandleRef.current) {
      setOhlc(lastCandleRef.current)
      setLastCandleClose(typeof lastCandleRef.current.close === 'number' ? lastCandleRef.current.close : null)
    }

    // Generate Mock Data for Indicator Panels (Phase 2)
    const times = candleData.map(c => c.time)
    const lsData = []
    const oiData = []
    const volData = []
    const liqDataMock: Array<{
      time: unknown
      longLiquidationUsd: number
      shortLiquidationUsd: number
      totalUsd: number
    }> = []
    
    // Seeded random for deterministic data
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + (interval === '15m' ? 1 : 2)
    // Simple deterministic RNG
    let s = seed;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    // Long/Short ratio centered around 1.0 (>=1 bullish, <1 bearish)
    // Make it look like the reference: jagged/high-frequency with frequent 1.0 crossovers.
    let ls = 1 + (rng() - 0.5) * 0.1
    let curOi = 650000
    
    for (let i = 0; i < times.length; i++) {
       const t = times[i]
       // Long/Short: mean reversion around 1.0 + strong noise + occasional spikes
       const shock = (rng() - 0.5) * 0.28
       const meanRevert = (1 - ls) * 0.18
       const hf = (i % 2 === 0 ? 1 : -1) * (0.06 + rng() * 0.04) // high-frequency zigzag
       const spike = rng() < 0.06 ? (rng() - 0.5) * 0.5 : 0
       ls = ls + meanRevert + shock + hf + spike
       const lsVal = Number(Math.max(0.4, Math.min(1.6, ls)).toFixed(4))
       lsData.push({
         time: t,
         value: lsVal,
         // lightweight-charts supports per-point color on LineSeries (segment uses point color)
         color: lsVal >= 1 ? '#22c55e' : '#ef4444',
       })

       // OI: Walk
       curOi += (rng() - 0.5) * 5000
       oiData.push({ time: t, value: Math.floor(curOi) })

       // Volume: Random positive
       volData.push({ time: t, value: Math.floor(rng() * 2000), color: '#4ade80' })

       // Liquidation: long/short liquidation USD (both positive); render as +/- around 0
       const shortUsd = Math.max(0, (rng() ** 2) * 8_000_000) // skewed distribution
       const longUsd = Math.max(0, (rng() ** 2) * 8_000_000)
       liqDataMock.push({
         time: t,
         longLiquidationUsd: Math.round(longUsd),
         shortLiquidationUsd: Math.round(shortUsd),
         totalUsd: Math.round(longUsd + shortUsd),
       })
    }
    
    setIndicatorData({
        ls: lsData,
        oi: oiData,
        vol: volData,
        liq: liqDataMock
    })

    // After data update, best-effort push current visible range to sub-charts
    try {
      const range = chartApi.timeScale().getVisibleLogicalRange()
      if (range) {
        Object.values(subChartsRef.current).forEach((sub) => {
          sub.timeScale().setVisibleLogicalRange(range)
        })
      }
    } catch {
      // ignore
    }
  }, [isMounted, symbol, interval, activeIndicators, lockedPrice])

  // Denser mock for overlay (more price buckets -> more bars), without affecting the full page.
  const liqData = useMemo(
    () => generateLiquidationMapMockData(baseAsset, '1d', 'All', lockedPrice, 320),
    [baseAsset, lockedPrice],
  )
  useEffect(() => {
    liqDataRef.current = liqData
    // Precompute numeric arrays for fast sampling on hover/click
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
  const liqCurrentPrice = lockedPrice
  const showLiqOverlay = activeIndicators.some((x) => x.id === 'liquidation-map')
  const isPanelOn = (id: string) => activeIndicators.some((x) => x.id === id)

  return (
    <div className="w-full h-full bg-[#0d1117] min-h-[500px] overflow-hidden flex flex-col">
      {/* Main chart area (takes remaining height), panels are below */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Active indicators chips (click to remove) */}
        {activeIndicators.length > 0 && (
          <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2 max-w-[60%] justify-end">
            {activeIndicators.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => onRemoveIndicator?.(ind.id)}
                className="pointer-events-auto flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#161b22]/90 border border-[#30363d] text-xs text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
                title={t('chart.indicator.remove', { name: ind.label })}
              >
                <span className="truncate max-w-[180px]">{ind.label}</span>
                <span className="text-[#8b949e] hover:text-white">×</span>
              </button>
            ))}
          </div>
        )}

        {/* Overlay widgets (non-series indicators)
            NOTE: Liquidation Map is rendered as a true chart overlay (ECharts panel on the right),
            so we intentionally do NOT show the placeholder card for it. */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2 items-end pointer-events-none">
          {activeIndicators
            .filter((x) => x.kind === 'chartOverlay' && x.id !== 'liquidation-map')
            .map((x) => (
              <div key={x.id} className="pointer-events-auto w-[320px] bg-[#161b22]/95 border border-[#30363d] rounded-xl p-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white truncate">{x.label}</div>
                  <button
                    type="button"
                    onClick={() => onRemoveIndicator?.(x.id)}
                    className="text-[#8b949e] hover:text-white transition-colors"
                    aria-label={t('chart.indicator.removeAria', { name: x.label })}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 text-xs text-[#8b949e] leading-relaxed">
                  {t('chart.indicator.overlayPlaceholder')}
                </div>
                {x.href && (
                  <a href={x.href} className="mt-2 inline-block text-xs text-primary hover:underline">
                    {t('chart.indicator.openFull')}
                  </a>
                )}
              </div>
            ))}
        </div>

        {/* Chart Legend / Info Overlay */}
        {ohlc && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px] text-white">₿</div>
              <span className="text-[#c9d1d9]">{symbol} {t('chart.perpetual')} · {interval} · OKX</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex gap-1">
                <span className="text-[#8b949e]">{t('chart.ohlc.open')}=</span>
                <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.open.toFixed(2)}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-[#8b949e]">{t('chart.ohlc.high')}=</span>
                <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.high.toFixed(2)}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-[#8b949e]">{t('chart.ohlc.low')}=</span>
                <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.low.toFixed(2)}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-[#8b949e]">{t('chart.ohlc.close')}=</span>
                <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>{ohlc.close.toFixed(2)}</span>
              </div>
              <div className="flex gap-1">
                <span className={ohlc.close >= ohlc.open ? 'text-[#2ea043]' : 'text-[#da3633]'}>
                  {(ohlc.close - ohlc.open).toFixed(2)} ({( ((ohlc.close - ohlc.open) / ohlc.open) * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1">
              <div className="flex gap-1">
                <span className="text-[#8b949e]">{t('chart.volume')}</span>
                <span className="text-[#26a69a]">201.94</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toolbar (Optional - like the one on the left in image) */}
        <div className="absolute top-1/4 left-2 z-10 flex flex-col gap-2 bg-[#161b22] border border-[#30363d] p-1 rounded">
          {['+', '-', '✎', '⌗', '○', 'T'].map((tool, i) => (
            <button key={i} className="w-7 h-7 flex items-center justify-center text-[#8b949e] hover:bg-[#30363d] rounded transition-colors">
              {tool}
            </button>
          ))}
        </div>

        {/* Chart host (Lightweight renders into this div; it may be cleared/recreated) */}
        <div ref={chartHostRef} className="w-full h-full" />

        {/* Liquidation overlay (ECharts, Coinglass-style) */}
        {showLiqOverlay && (
          <div
            id="liqOverlayPanel"
            className="pointer-events-none absolute top-0 bottom-[24px] z-[6]"
            style={{
              right: 72,
              width: 260,
              opacity: 0.85,
            }}
          >
            <LiquidationMapChart
              ref={overlayRef as any}
              mode="overlay"
              data={liqData}
              currentPrice={liqCurrentPrice}
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

        {/* Click-to-inspect tooltip (does not capture pointer events) */}
        {showLiqOverlay && liqSelected && (
          <div
            className="pointer-events-none absolute z-[7] w-[260px]"
            style={{
              // Pin tooltip inside the overlay band (right of main plot, left of price scale)
              right: 72 + 8,
              top: clamp(liqSelected.y - 64, 8, (chartHostRef.current?.clientHeight ?? 520) - 170),
            }}
          >
            <div className="bg-[#0d1117]/85 border border-[#30363d] rounded-lg px-3 py-2 text-xs text-[#c9d1d9] backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="font-bold">价格: {liqSelected.price.toFixed(liqSelected.price >= 100 ? 0 : 2)}</div>
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
              {/* Match full-page tooltip: show only the relevant cumulative side */}
              <div className="mt-2 space-y-1 text-[#8b949e]">
                {liqSelected.price <= liqCurrentPrice ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#ff4d4d' }} />
                      <span>累计多单清算</span>
                    </span>
                    <span className="text-[#e6edf3] font-bold">{formatUsdCompactFromMillions(liqSelected.cumLong)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#00c076' }} />
                      <span>累计空单清算</span>
                    </span>
                    <span className="text-[#e6edf3] font-bold">{formatUsdCompactFromMillions(liqSelected.cumShort)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Phase 2: Four Indicator Panels (Real Instances) */}
      {isPanelOn('long-short-ratio') && (
        <IndicatorChartPanel 
           id="ls"
           title="聚合多空比"
           color="#22c55e"
           height={70}
           type="line"
           data={indicatorData.ls}
           mainChart={chartRef.current}
           registerChart={registerChart}
           unregisterChart={unregisterChart}
           onClose={() => onRemoveIndicator?.('long-short-ratio')}
           showTvLogo={false}
           formatter={(v) => v.toFixed(4)}
           priceFormatter={(v) => Number(v).toFixed(2)}
        />
      )}
      {isPanelOn('aggregated-open-interest') && (
        <IndicatorChartPanel 
           id="oi"
           title="聚合持仓"
           color="#22d3ee"
           height={70}
           type="area"
           data={indicatorData.oi}
           mainChart={chartRef.current}
           registerChart={registerChart}
           unregisterChart={unregisterChart}
           onClose={() => onRemoveIndicator?.('aggregated-open-interest')}
           showTvLogo={false}
           formatter={(v) => formatCompactNumber(v)} // OI is position size (not price)
           priceFormatter={(v) => formatCompactNumber(v)}
        />
      )}
      {isPanelOn('aggregated-volume') && (
        <IndicatorChartPanel 
           id="vol"
           title="聚合成交量"
           color="#4ade80"
           height={70}
           type="bar"
           data={indicatorData.vol}
           mainChart={chartRef.current}
           registerChart={registerChart}
           unregisterChart={unregisterChart}
           onClose={() => onRemoveIndicator?.('aggregated-volume')}
           showTvLogo={false}
           formatter={(v) => `${(v/1000).toFixed(3)}K`}
           priceFormatter={(v) => formatCompactNumber(v)}
        />
      )}
      {isPanelOn('liquidation-data') && (
        <IndicatorChartPanel 
           id="liq"
           title="聚合爆仓"
           color="#ef4444"
           height={69}
           type="liquidation"
           data={indicatorData.liq}
           mainChart={chartRef.current}
           registerChart={registerChart}
           unregisterChart={unregisterChart}
           onClose={() => onRemoveIndicator?.('liquidation-data')}
           showTvLogo={true}
           formatter={(v) => v.toFixed(4)}
           priceFormatter={(v) => (v < 0 ? `-${formatUsdCompact(Math.abs(v))}` : formatUsdCompact(v))}
        />
      )}
      
    </div>
  );
};

