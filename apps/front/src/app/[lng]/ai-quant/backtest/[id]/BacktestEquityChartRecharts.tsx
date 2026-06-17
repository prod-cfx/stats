'use client'

import type { EquityPoint } from './backtest-report-data'
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- loaded only through BacktestEquityChart next/dynamic boundary; keep Recharts symbols together for chart rendering.
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

interface BacktestEquityChartRechartsProps {
  lng: string
  chartData: EquityPoint[]
  minEquity: number
  maxEquity: number
  minDrawdown: number
  themeTick: number
  textColor: string
  xAxisTextColor: string
  splitLineColor: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

export function BacktestEquityChartRecharts({
  lng,
  chartData,
  minEquity,
  maxEquity,
  minDrawdown,
  themeTick,
  textColor,
  xAxisTextColor,
  splitLineColor,
  tooltipBg,
  tooltipBorder,
  tooltipText,
}: BacktestEquityChartRechartsProps) {
  return (
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
  )
}
