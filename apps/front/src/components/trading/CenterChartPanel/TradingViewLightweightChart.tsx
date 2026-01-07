'use client';

import type { LiquidationMapChartHandle } from '@/components/liquidation-map/LiquidationMapChart'
import type { ChartAdapter } from '@/components/trading/chart-adapter/chart-adapter'
import { CandlestickSeries, ColorType, createChart, CrosshairMode, HistogramSeries, LineSeries } from 'lightweight-charts'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { createLightweightChartAdapter } from '@/components/trading/chart-adapter/lightweight-chart-adapter'
import { generateLiquidationMapMockData } from '@/lib/liquidation-map/mock-liquidation-map'
import { getMockBasePrice, getMockVolatility } from '@/lib/mock/market'

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

    const unsubChartChange = chartAdapter?.subscribeChartChange(refreshOverlay) ?? (() => {})
    // Initial sync (chartRef is now ready)
    refreshOverlay()

    return () => {
      resizeObserver.disconnect();
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

    // 更新 chartSeries 指标（仅 setData，不新增/删除 series）
    const isOn = (id: string) => activeIndicators.some((x) => x.id === id)
    const timeVals = candleData.map((c) => c.time)

    // long-short-ratio
    if (indicatorSeriesRef.current['long-short-ratio']) {
      if (isOn('long-short-ratio')) {
        const data: Array<{ time: unknown; value: number }> = []
        let ls = 0.52
        for (let i = 0; i < timeVals.length; i++) {
          ls += (Math.random() - 0.5) * 0.015
          ls = Math.max(0.2, Math.min(0.8, ls))
          data.push({ time: timeVals[i], value: Number(ls.toFixed(4)) })
        }
        indicatorSeriesRef.current['long-short-ratio'].setData(data as unknown[])
      } else {
        indicatorSeriesRef.current['long-short-ratio'].setData([])
      }
    }

    // aggregated-open-interest
    if (indicatorSeriesRef.current['aggregated-open-interest']) {
      if (isOn('aggregated-open-interest')) {
        const data: Array<{ time: unknown; value: number }> = []
        let oi = basePrice * 120
        for (let i = 0; i < timeVals.length; i++) {
          oi += (Math.random() - 0.45) * (basePrice * 2)
          oi = Math.max(basePrice * 60, oi)
          data.push({ time: timeVals[i], value: Math.floor(oi) })
        }
        indicatorSeriesRef.current['aggregated-open-interest'].setData(data as unknown[])
      } else {
        indicatorSeriesRef.current['aggregated-open-interest'].setData([])
      }
    }

    // aggregated-volume
    if (indicatorSeriesRef.current['aggregated-volume']) {
      if (isOn('aggregated-volume')) {
        const data: Array<{ time: unknown; value: number; color: string }> = []
        for (let i = 0; i < timeVals.length; i++) {
          data.push({
            time: timeVals[i],
            value: Math.floor(Math.random() * (basePrice >= 1000 ? 20000 : 200000)),
            color: 'rgba(236, 72, 153, 0.45)',
          })
        }
        indicatorSeriesRef.current['aggregated-volume'].setData(data as unknown[])
      } else {
        indicatorSeriesRef.current['aggregated-volume'].setData([])
      }
    }

    // liquidation-data
    if (indicatorSeriesRef.current['liquidation-data']) {
      if (isOn('liquidation-data')) {
        const data: Array<{ time: unknown; value: number; color: string }> = []
        for (let i = 0; i < timeVals.length; i++) {
          const spike = Math.random() < 0.08 ? 1 + Math.random() * 6 : Math.random()
          data.push({
            time: timeVals[i],
            value: Math.floor(spike * (basePrice >= 1000 ? 1200 : 18000)),
            color: 'rgba(239, 68, 68, 0.45)',
          })
        }
        indicatorSeriesRef.current['liquidation-data'].setData(data as unknown[])
      } else {
        indicatorSeriesRef.current['liquidation-data'].setData([])
      }
    }

    // 防回归：切换周期也执行一次 applyOptions（不创建新线）
    if (lockedPriceLineRef.current && typeof lockedPrice === 'number' && Number.isFinite(lockedPrice)) {
      lockedPriceLineRef.current.applyOptions({ price: lockedPrice, axisLabelVisible: true })
      console.log('[LOCKED PRICE LINE UPDATED]', lockedPrice)
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

  return (
    <div className="w-full h-full bg-[#0d1117] min-h-[500px] relative overflow-hidden">
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
  );
};

