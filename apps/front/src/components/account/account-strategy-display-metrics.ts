import type { StrategyEquityPoint } from './ai-quant-strategy-store'

interface ResolveDisplayMetricsInput {
  totalPnl: number | null | undefined
  todayPnl: number | null | undefined
  series: StrategyEquityPoint[]
  initialCapital: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function toUtcDayKey(input: string): string {
  const date = new Date(input)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }
  return input.slice(0, 10)
}

function fallbackTotalPnl(series: StrategyEquityPoint[], initialCapital: number): number {
  if (series.length >= 2) {
    const first = series[0]?.value ?? 0
    const last = series[series.length - 1]?.value ?? 0
    return round2(last - first)
  }

  if (series.length === 1 && isFiniteNumber(initialCapital)) {
    const only = series[0]?.value ?? 0
    return round2(only - initialCapital)
  }

  return 0
}

function fallbackTodayPnl(series: StrategyEquityPoint[]): number {
  if (series.length === 0) return 0
  const lastKey = toUtcDayKey(series[series.length - 1]?.ts ?? '')
  const daySeries = series.filter(item => toUtcDayKey(item.ts) === lastKey)
  if (daySeries.length < 2) return 0

  const first = daySeries[0]?.value ?? 0
  const last = daySeries[daySeries.length - 1]?.value ?? 0
  return round2(last - first)
}

export function resolveDisplayMetrics(input: ResolveDisplayMetricsInput): {
  displayTotalPnl: number
  displayTodayPnl: number
} {
  const displayTotalPnl = isFiniteNumber(input.totalPnl)
    ? round2(input.totalPnl)
    : fallbackTotalPnl(input.series, input.initialCapital)

  const displayTodayPnl = isFiniteNumber(input.todayPnl)
    ? round2(input.todayPnl)
    : fallbackTodayPnl(input.series)

  return {
    displayTotalPnl,
    displayTodayPnl,
  }
}

