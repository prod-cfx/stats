'use client'

import type { EquityPoint } from './backtest-report-data'
import React, { useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface BacktestEquityChartProps {
  lng: string
  data: EquityPoint[]
}

const MAX_CHART_POINTS = 1_500

function downsampleEquitySeries(data: EquityPoint[]): EquityPoint[] {
  if (data.length <= MAX_CHART_POINTS) {
    return data
  }

  const step = Math.ceil(data.length / (MAX_CHART_POINTS - 1))
  const sampled: EquityPoint[] = []
  for (let index = 0; index < data.length; index += step) {
    sampled.push(data[index])
  }
  const last = data[data.length - 1]
  if (last && sampled[sampled.length - 1] !== last) {
    if (sampled.length >= MAX_CHART_POINTS) {
      sampled.pop()
    }
    sampled.push(last)
  }
  return sampled
}

function calculateChartDomain(data: EquityPoint[]): {
  minEquity: number
  maxEquity: number
  minDrawdown: number
} {
  let minEquity = Number.POSITIVE_INFINITY
  let maxEquity = Number.NEGATIVE_INFINITY
  let minDrawdown = Number.POSITIVE_INFINITY

  for (const point of data) {
    if (Number.isFinite(point.equity)) {
      minEquity = Math.min(minEquity, point.equity)
      maxEquity = Math.max(maxEquity, point.equity)
    }
    if (Number.isFinite(point.drawdown)) {
      minDrawdown = Math.min(minDrawdown, point.drawdown)
    }
  }

  return {
    minEquity: Number.isFinite(minEquity) ? minEquity * 0.98 : 0,
    maxEquity: Number.isFinite(maxEquity) ? maxEquity * 1.02 : 1,
    minDrawdown: Math.min(Number.isFinite(minDrawdown) ? minDrawdown * 1.1 : 0, -10),
  }
}

export function BacktestEquityChart({ lng, data }: BacktestEquityChartProps) {
  const [themeTick, setThemeTick] = useState(0)

  React.useEffect(() => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
          setThemeTick(t => t + 1)
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  if (!data || data.length === 0) {
    return (
      <div
        data-testid="backtest-equity-empty"
        className="flex h-[280px] items-center justify-center rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 px-5 py-4 backdrop-blur-sm sm:h-[360px] lg:h-[480px]"
      >
        <p className="!text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
          {lng === 'en' ? 'No backtest data available' : '暂无回测数据'}
        </p>
      </div>
    )
  }

  const chartData = downsampleEquitySeries(data)
  const { minEquity, maxEquity, minDrawdown } = calculateChartDomain(data)

  let isDark = true
  if (typeof document !== 'undefined') {
    isDark =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      getComputedStyle(document.documentElement).getPropertyValue('color-scheme') === 'dark'
  }

  const textColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
  const xAxisTextColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'
  const splitLineColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const tooltipBg = isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.9)'
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tooltipText = isDark ? '#fff' : '#000'

  return (
    <div
      data-testid="backtest-equity-chart-frame"
      className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 px-5 py-4 backdrop-blur-sm"
    >
      <h3 className="mb-4 !text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
        {lng === 'en' ? 'Equity & Backtest Performance' : '净值与回测表现'}
      </h3>
      <div data-testid="backtest-equity-chart-body" className="h-[300px] w-full sm:h-[360px] lg:h-[400px]" key={themeTick}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF4D4F" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#FF4D4F" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={splitLineColor} strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="transparent"
              tick={{ fill: xAxisTextColor, fontSize: 12 }}
              tickMargin={10}
              minTickGap={30}
            />

            <YAxis
              yAxisId="equity"
              domain={[minEquity, maxEquity]}
              stroke="transparent"
              tick={{ fill: textColor, fontSize: 12 }}
              tickFormatter={v => `$${v.toFixed(0)}`}
              width={80}
            />

            <YAxis
              yAxisId="drawdown"
              orientation="right"
              domain={[minDrawdown, 0]}
              stroke="transparent"
              tick={{ fill: textColor, fontSize: 12 }}
              tickFormatter={v => `${v.toFixed(0)}%`}
              width={60}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              itemStyle={{ color: tooltipText }}
              formatter={(value, name) => {
                const numericValue = typeof value === 'number' ? value : Number(value)
                if (name === 'equity') {
                  return [`$${numericValue.toFixed(2)}`, lng === 'en' ? 'Equity' : '净值']
                }
                if (name === 'drawdown') {
                  return [`${numericValue.toFixed(2)}%`, lng === 'en' ? 'Drawdown' : '回撤']
                }
                return [String(value ?? ''), String(name)]
              }}
              labelStyle={{ color: textColor, marginBottom: '8px' }}
            />

            <Area
              yAxisId="drawdown"
              type="monotone"
              dataKey="drawdown"
              stroke="none"
              fill="url(#drawdownGradient)"
              baseValue={0}
              isAnimationActive={false}
            />

            <Line
              yAxisId="equity"
              type="monotone"
              dataKey="equity"
              stroke="#00C087"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#00C087', stroke: tooltipBg, strokeWidth: 2 }}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
