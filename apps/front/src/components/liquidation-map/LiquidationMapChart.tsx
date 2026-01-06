'use client';

import * as echarts from 'echarts';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface LiquidationMapChartProps {
  data: {
    labels: string[];
    bybit: number[];
    okx: number[];
    binance: number[];
    dex: number[];
    cumulativeLong: (number | null)[];
    cumulativeShort: (number | null)[];
  };
  currentPrice: number;
  /**
   * full: keep the existing liquidation map page behavior unchanged
   * overlay: render right-side stacked liquidation bars aligned by price via Lightweight priceToCoordinate
   */
  mode?: 'full' | 'overlay';
  /**
   * Overlay only: map price -> y(px) in the Lightweight chart coordinate system
   */
  getPriceToY?: (price: number) => number | null;
  /**
   * Overlay only: used for layout calculations (graphic widths)
   */
  overlayWidth?: number;
  /**
   * Overlay only: overall opacity (also controlled by outer container)
   */
  overlayOpacity?: number;
  /**
   * Overlay only: selected bucket price (for click-to-inspect)
   */
  selectedPrice?: number | null;
}

export interface LiquidationMapChartHandle {
  /**
   * Overlay only: force a redraw (used when Lightweight visible range / zoom changes)
   */
  refresh: () => void;
}

interface OverlayRow {
  price: number;
  bybit: number;
  okx: number;
  binance: number;
  dex: number;
  total: number;
  cumLong: number;
  cumShort: number;
}

function parsePriceLabel(label: string): number | null {
  const n = Number.parseFloat(String(label).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
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

function pickOverlayPriceStep(currentPrice: number): number {
  // Defaults follow the requirement "10 or 20" for typical large-asset charts.
  if (currentPrice >= 10000) return 20
  if (currentPrice >= 1000) return 10
  if (currentPrice >= 100) return 1
  if (currentPrice >= 10) return 0.1
  return 0.01
}

type Point2D = [number, number]

/**
 * Catmull-Rom spline -> cubic Bezier path (SVG pathData)
 * - Smooth, C1-continuous curve through all points
 * - Works well for chart-like polylines
 */
export function smoothPath(points: Point2D[]): string {
  if (!points || points.length < 2) return ''
  const p = points
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p2

    // Standard Catmull-Rom to Bezier conversion (tension=0.5 => factor 1/6)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

function _stripInitialMove(pathData: string): string {
  // Remove "M x y" at the beginning (keep following segments).
  return pathData.replace(/^M\s*[-\d.]+\s*[-\d.]+\s*/i, '')
}

export const LiquidationMapChart = forwardRef<LiquidationMapChartHandle, LiquidationMapChartProps>(
  (
    {
      data,
      currentPrice,
      mode = 'full',
      getPriceToY,
      overlayWidth = 260,
      overlayOpacity = 0.85,
      selectedPrice = null,
    },
    ref,
  ) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);
  const { t } = useTranslation();

  const colors = useMemo(
    () => ({
      bybit: '#36b8c9',
      okx: '#f7d05e',
      binance: '#f08024',
      dex: '#bf5af2',
      cumLongLine: '#ff4d4d',
      cumShortLine: '#00c076',
      currentPrice: '#ff4d4d',
    }),
    [],
  );

  // Init once; update many times (critical constraint)
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }

    const chart = chartInstanceRef.current;
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  const overlayRows: OverlayRow[] = useMemo(() => {
    const rows: OverlayRow[] = [];
    const n = data.labels.length;
    for (let i = 0; i < n; i++) {
      const price = parsePriceLabel(data.labels[i]);
      if (price === null) continue;
      const bybit = data.bybit[i] ?? 0;
      const okx = data.okx[i] ?? 0;
      const binance = data.binance[i] ?? 0;
      const dex = data.dex[i] ?? 0;
      const total = bybit + okx + binance + dex;
      const cumLong = (data.cumulativeLong[i] ?? 0) as number;
      const cumShort = (data.cumulativeShort[i] ?? 0) as number;
      rows.push({
        price,
        bybit,
        okx,
        binance,
        dex,
        total,
        cumLong: typeof cumLong === 'number' && Number.isFinite(cumLong) ? cumLong : 0,
        cumShort: typeof cumShort === 'number' && Number.isFinite(cumShort) ? cumShort : 0,
      });
    }
    rows.sort((a, b) => a.price - b.price)
    return rows;
  }, [data]);

  const buildFullOption = () => {
    // Use the intersection point of the two cumulative trends (where they both start from 0)
    // This ensures the current price line is always exactly where the red/green curves meet
    const currentPriceIndex = data.cumulativeLong.findIndex((v) => v === 0);

    const legendBybit = t('liquidationMap.legend.bybit');
    const legendOkx = t('liquidationMap.legend.okx');
    const legendBinance = t('liquidationMap.legend.binance');
    const legendDex = t('liquidationMap.legend.dex');
    const legendCumLong = t('liquidationMap.legend.cumLong');
    const legendCumShort = t('liquidationMap.legend.cumShort');

    return {
      backgroundColor: '#0d1117',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'none',
        },
        backgroundColor: 'rgba(22, 27, 34, 0.95)',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: any) => {
          let res = `<div style="font-weight: bold; margin-bottom: 4px;">${t(
            'liquidationMap.tooltip.price',
          )}: ${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            if (
              item.value === 0 ||
              item.value === undefined ||
              item.value === null ||
              item.seriesName === 'CurrentPriceAnchor'
            )
              return;
            const valueStr =
              item.seriesName === legendCumLong || item.seriesName === legendCumShort
                ? `$${item.value.toFixed(2)}B`
                : `$${item.value}M`;
            res += `
              <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-bottom: 2px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: ${item.color};"></span>
                  <span>${item.seriesName}</span>
                </div>
                <span style="font-weight: bold;">${valueStr}</span>
              </div>`;
          });
          return res;
        },
      },
      legend: {
        data: [legendBybit, legendOkx, legendBinance, legendDex, legendCumLong, legendCumShort],
        top: 20,
        textStyle: { color: '#8b949e', fontSize: 11 },
        icon: 'rect',
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '12%',
        top: '15%',
        containLabel: true,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 10,
          height: 20,
          borderColor: 'transparent',
          backgroundColor: '#161b22',
          fillerColor: 'rgba(59, 130, 246, 0.1)',
          handleIcon:
            'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
          handleSize: '80%',
          handleStyle: {
            color: '#30363d',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            shadowOffsetX: 2,
            shadowOffsetY: 2,
          },
          textStyle: { color: '#8b949e' },
          selectedDataBackground: {
            lineStyle: { color: '#3b82f6' },
            areaStyle: { color: '#3b82f6' },
          },
          brushSelect: false,
        },
      ],
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#8b949e', fontSize: 10, interval: 10 },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#1c2128', type: 'dashed' } },
          axisLabel: {
            color: '#8b949e',
            fontSize: 10,
            formatter: (value: number) => `$${value}M`,
          },
        },
        {
          type: 'value',
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: '#8b949e',
            fontSize: 10,
            formatter: (value: number) => `$${value}B`,
          },
        },
      ],
      series: [
        {
          name: legendBybit,
          type: 'bar',
          stack: 'total',
          data: data.bybit,
          itemStyle: { color: colors.bybit },
          barWidth: '80%',
          z: 5,
        },
        {
          name: legendOkx,
          type: 'bar',
          stack: 'total',
          data: data.okx,
          itemStyle: { color: colors.okx },
          z: 5,
        },
        {
          name: legendBinance,
          type: 'bar',
          stack: 'total',
          data: data.binance,
          itemStyle: { color: colors.binance },
          z: 5,
        },
        {
          name: legendDex,
          type: 'bar',
          stack: 'total',
          data: data.dex,
          itemStyle: { color: colors.dex },
          z: 5,
        },
        {
          name: 'CurrentPriceAnchor',
          type: 'line',
          silent: true,
          data: Array.from({ length: data.labels.length }).fill(0),
          showSymbol: false,
          lineStyle: { opacity: 0 },
          markLine: {
            silent: true,
            symbol: ['none', 'arrow'],
            symbolSize: [0, 15],
            lineStyle: {
              color: colors.currentPrice,
              type: 'dashed',
              width: 2,
              opacity: 1,
            },
            label: {
              show: true,
              position: 'end',
              distance: 10,
              formatter: `{label|${t('liquidationMap.currentPrice')}: }{value|${currentPrice.toLocaleString()}}`,
              rich: {
                label: {
                  color: '#e6edf3',
                  fontSize: 11,
                },
                value: {
                  color: '#ff4d4d',
                  fontSize: 11,
                  fontWeight: 'bold',
                },
              },
              backgroundColor: '#161b22',
              borderColor: '#30363d',
              borderWidth: 1,
              borderRadius: 4,
              padding: [4, 8],
            },
            data: [
              [
                {
                  xAxis: currentPriceIndex,
                  yAxis: 0,
                },
                {
                  xAxis: currentPriceIndex,
                  y: '15%',
                },
              ],
            ],
            z: 100,
          },
        },
        {
          name: legendCumLong,
          type: 'line',
          yAxisIndex: 1,
          data: data.cumulativeLong,
          smooth: 0.4,
          symbol: 'none',
          lineStyle: { color: colors.cumLongLine, width: 2 },
          itemStyle: { color: colors.cumLongLine },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255, 77, 77, 0.2)' },
              { offset: 1, color: 'rgba(255, 77, 77, 0)' },
            ]),
          },
          z: 10,
        },
        {
          name: legendCumShort,
          type: 'line',
          yAxisIndex: 1,
          data: data.cumulativeShort,
          smooth: 0.4,
          symbol: 'none',
          lineStyle: { color: colors.cumShortLine, width: 2 },
          itemStyle: { color: colors.cumShortLine },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 192, 118, 0.2)' },
              { offset: 1, color: 'rgba(0, 192, 118, 0)' },
            ]),
          },
          z: 10,
        },
      ],
    };
  };

  function computeOverlayBarHeight(H: number): number {
    // Estimate the y-distance between adjacent visible buckets (using getPriceToY),
    // then pick a bar height that looks like the full map style but won't overlap too much.
    if (!getPriceToY || overlayRows.length < 2 || H <= 0) return 6
    const ys: number[] = []
    for (let i = 0; i < overlayRows.length; i += Math.max(1, Math.floor(overlayRows.length / 40))) {
      const y = getPriceToY(overlayRows[i].price)
      if (typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= H) ys.push(y)
      if (ys.length >= 30) break
    }
    ys.sort((a, b) => a - b)
    const deltas: number[] = []
    for (let i = 1; i < ys.length; i++) {
      const d = ys[i] - ys[i - 1]
      if (d > 0.5 && d < 60) deltas.push(d)
    }
    if (!deltas.length) return 6
    deltas.sort((a, b) => a - b)
    const median = deltas[Math.floor(deltas.length / 2)]
    const h = Math.max(3, Math.min(10, Math.floor(median * 0.75)))
    return h
  }

  const buildOverlayGraphic = () => {
    const el = chartRef.current;
    const W = el?.clientWidth ?? overlayWidth;
    const H = el?.clientHeight ?? 0;
    const barH = computeOverlayBarHeight(H);

    const elements: any[] = [];

    // "点亮测试开关": no data -> show OVERLAY READY
    if (!overlayRows.length || !getPriceToY) {
      elements.push({
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
          text: 'OVERLAY READY',
          fill: 'rgba(201, 209, 217, 0.6)',
          fontSize: 12,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        },
      });
      return { W, H, elements };
    }

    // ---- A) densify price buckets (continuous bars) ----
    const minPrice = overlayRows[0].price
    const maxPrice = overlayRows[overlayRows.length - 1].price
    const step = pickOverlayPriceStep(currentPrice)
    const buffer = step * 8
    const start = Math.floor((minPrice - buffer) / step) * step
    const end = Math.ceil((maxPrice + buffer) / step) * step

    // Build original arrays for interpolation
    const xs = overlayRows.map((r) => r.price)
    const ysBybit = overlayRows.map((r) => r.bybit)
    const ysOkx = overlayRows.map((r) => r.okx)
    const ysBinance = overlayRows.map((r) => r.binance)
    const ysDex = overlayRows.map((r) => r.dex)
    const ysCumLong = overlayRows.map((r) => r.cumLong)
    const ysCumShort = overlayRows.map((r) => r.cumShort)

    const densified: OverlayRow[] = []
    for (let p = start; p <= end + step / 2; p += step) {
      const bybit = Math.max(0, interpolateByPrice(xs, ysBybit, p))
      const okx = Math.max(0, interpolateByPrice(xs, ysOkx, p))
      const binance = Math.max(0, interpolateByPrice(xs, ysBinance, p))
      const dex = Math.max(0, interpolateByPrice(xs, ysDex, p))
      const total = bybit + okx + binance + dex
      // Must reuse existing cumulative fields (full page data): use interpolated cumulative arrays.
      const cumLong = Math.max(0, interpolateByPrice(xs, ysCumLong, p))
      const cumShort = Math.max(0, interpolateByPrice(xs, ysCumShort, p))
      densified.push({ price: p, bybit, okx, binance, dex, total, cumLong, cumShort })
    }

    const maxTotal = densified.reduce((m, r) => (r.total > m ? r.total : m), 0) || 1

    // Bar height derived from dy between adjacent price buckets (aligns with chosen step).
    const y0 = getPriceToY(densified[Math.floor(densified.length / 2)]?.price)
    const y1 = getPriceToY(densified[Math.floor(densified.length / 2) + 1]?.price)
    const dy = typeof y0 === 'number' && typeof y1 === 'number' ? Math.abs(y1 - y0) : barH
    const barHeight = Math.max(2, Math.min(12, Math.floor((Number.isFinite(dy) ? dy : barH) * 0.8)))

    // ---- B) stacked bars (graphic rect) ----
    for (const row of densified) {
      const yRaw = getPriceToY(row.price);
      if (yRaw == null) continue;
      const y = yRaw;
      if (y < -barHeight || y > H + barHeight) continue;

      // Normalize widths; right-aligned stack (extends left)
      const wBybit = (row.bybit / maxTotal) * W;
      const wOkx = (row.okx / maxTotal) * W;
      const wBinance = (row.binance / maxTotal) * W;
      const wDex = (row.dex / maxTotal) * W;

      let rightX = W;
      const pushSeg = (width: number, fill: string) => {
        if (width <= 0.5) return;
        const x = rightX - width;
        elements.push({
          type: 'rect',
          silent: true,
          shape: { x, y: y - barHeight / 2, width, height: barHeight },
          style: {
            fill,
            opacity: overlayOpacity,
            // subtle "echarts bar" feel
            shadowBlur: 0,
          },
        });
        rightX = x;
      };

      // Order: Bybit / OKX / Binance / DEX (same as full legend)
      pushSeg(wBybit, colors.bybit);
      pushSeg(wOkx, colors.okx);
      pushSeg(wBinance, colors.binance);
      pushSeg(wDex, colors.dex);

      // Selected row highlight (thin outline)
      // Note: overlay uses densified fixed-step prices; selectedPrice comes from original buckets,
      // so match within half-step tolerance.
      const tol = step / 2 + 1e-6
      if (selectedPrice != null && Math.abs(row.price - selectedPrice) <= tol) {
        elements.push({
          type: 'rect',
          silent: true,
          shape: { x: 0, y: y - barHeight / 2 - 1, width: W, height: barHeight + 2 },
          style: {
            fill: 'transparent',
            stroke: 'rgba(201, 209, 217, 0.55)',
            lineWidth: 1,
          },
        })
      }
    }

    // ---- C) cumulative curves (mirrored, same scale) ----
    // Mirror-symmetric spec:
    // 1) maxCum = max(maxCumLong, maxCumShort, 1)
    // 2) xL = pad + (cumLong/maxCum) * (W - pad*2)
    // 3) xS = W - pad - (cumShort/maxCum) * (W - pad*2)
    // 4) Both curves iterate price buckets in the same direction to avoid path crossings.
    const pad = 10

    // Compute visible maxima (avoid flattening). Use the same price-direction for both later.
    let maxCumLong = 0
    let maxCumShort = 0
    for (const r of densified) {
      const y = getPriceToY(r.price)
      if (typeof y !== 'number' || !Number.isFinite(y)) continue
      if (y < -20 || y > H + 20) continue
      if (r.price <= currentPrice && r.cumLong > maxCumLong) maxCumLong = r.cumLong
      if (r.price >= currentPrice && r.cumShort > maxCumShort) maxCumShort = r.cumShort
    }
    const maxCum = Math.max(maxCumLong, maxCumShort, 1)
    const span = Math.max(1, W - pad * 2)

    const longPts: Point2D[] = []
    const shortPts: Point2D[] = []

    // Iterate from high->low price for both curves (same direction).
    for (let i = densified.length - 1; i >= 0; i--) {
      const r = densified[i]
      const y = getPriceToY(r.price)
      if (typeof y !== 'number' || !Number.isFinite(y)) continue
      if (y < -20 || y > H + 20) continue

      if (r.price <= currentPrice) {
        const xL = pad + (r.cumLong / maxCum) * span
        longPts.push([clamp(xL, pad, W - pad), y])
      }
      if (r.price >= currentPrice) {
        const xS = W - pad - (r.cumShort / maxCum) * span
        shortPts.push([clamp(xS, pad, W - pad), y])
      }
    }

    // NOTE: Some builds of ECharts/zrender do not register graphic "path" type.
    // Use polyline/polygon with `smooth` to ensure we always render a smooth curve.
    const smooth = 0.35
    if (longPts.length >= 2) {
      const y0p = longPts[0][1]
      const yNp = longPts[longPts.length - 1][1]
      const fillPts: Point2D[] = [[pad, y0p], ...longPts, [pad, yNp]]

      elements.push({
        type: 'polygon',
        silent: true,
        shape: { points: fillPts, smooth },
        style: {
          fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(255, 77, 77, 0.16)' },
            { offset: 1, color: 'rgba(255, 77, 77, 0)' },
          ]),
        },
      })
      elements.push({
        type: 'polyline',
        silent: true,
        shape: { points: longPts, smooth },
        style: { stroke: colors.cumLongLine, lineWidth: 2, opacity: 0.95, fill: 'none' },
      })
    }

    if (shortPts.length >= 2) {
      const y0p = shortPts[0][1]
      const yNp = shortPts[shortPts.length - 1][1]
      const fillPts: Point2D[] = [[W - pad, y0p], ...shortPts, [W - pad, yNp]]

      elements.push({
        type: 'polygon',
        silent: true,
        shape: { points: fillPts, smooth },
        style: {
          fill: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: 'rgba(0, 192, 118, 0.16)' },
            { offset: 1, color: 'rgba(0, 192, 118, 0)' },
          ]),
        },
      })
      elements.push({
        type: 'polyline',
        silent: true,
        shape: { points: shortPts, smooth },
        style: { stroke: colors.cumShortLine, lineWidth: 2, opacity: 0.95, fill: 'none' },
      })
    }

    // ---- D) current price dashed line (horizontal) + label ----
    const yCurrent = getPriceToY(currentPrice)
    if (typeof yCurrent === 'number' && Number.isFinite(yCurrent)) {
      // Dashed line
      elements.push({
        type: 'line',
        silent: true,
        shape: { x1: 0, y1: yCurrent, x2: W, y2: yCurrent },
        style: {
          stroke: 'rgba(255, 77, 77, 0.85)',
          lineWidth: 1,
          lineDash: [6, 6],
        },
      })
      // Price label (red background, white text, similar to right price scale style)
      elements.push({
        type: 'text',
        silent: true,
        style: {
          text: `${currentPrice.toFixed(currentPrice >= 100 ? 0 : 2)}`,
          fill: '#ffffff',
          fontSize: 11,
          fontWeight: 700,
          backgroundColor: '#ef4444',
          borderRadius: 3,
          padding: [3, 6],
        },
        x: W - 6,
        y: yCurrent,
        align: 'right',
        verticalAlign: 'middle',
      })
    }

    // If nothing is in view (e.g. all coordinates out of range), still show the ready hint.
    if (elements.length === 0) {
      // Debug-friendly sentinel: try to render one small bar at currentPrice to confirm y mapping works.
      try {
        const y = getPriceToY?.(currentPrice)
        if (typeof y === 'number' && Number.isFinite(y)) {
          elements.push({
            type: 'rect',
            silent: true,
            shape: { x: W - 40, y: y - barHeight / 2, width: 40, height: barHeight },
            style: { fill: 'rgba(88, 166, 255, 0.6)' },
          })
        }
      } catch {
        // ignore
      }
      elements.push({
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
          text: 'OVERLAY READY',
          fill: 'rgba(201, 209, 217, 0.6)',
          fontSize: 12,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        },
      });
    }

    return { W, H, elements };
  };

  const apply = () => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    if (mode === 'overlay') {
      const { elements } = buildOverlayGraphic();
      chart.setOption(
        {
          backgroundColor: 'transparent',
          animation: false,
          xAxis: { show: false },
          yAxis: { show: false },
          series: [],
          tooltip: { show: false },
          grid: { left: 0, right: 0, top: 0, bottom: 0 },
          graphic: { elements },
        },
        { notMerge: true, lazyUpdate: true },
      );
      chart.resize();
      return;
    }

    // full mode: keep original option/behavior unchanged
    const option = buildFullOption();
    chart.setOption(option as any, { notMerge: true, lazyUpdate: true });
    chart.resize();
  };

  useImperativeHandle(ref, () => ({ refresh: apply }), [mode, data, currentPrice, t, getPriceToY, overlayWidth, overlayOpacity]);

  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data, currentPrice, t, getPriceToY, overlayWidth, overlayOpacity]);

  return (
    <div
      className={
        mode === 'full'
          ? 'relative w-full h-[600px] bg-[#0d1117] border border-[#30363d] rounded-lg p-2'
          : 'relative w-full h-full'
      }
    >
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
},
);
