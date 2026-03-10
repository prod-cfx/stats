import type { StrategyEquityPoint } from './ai-quant-strategy-store'

function toDayKey(input: string) {
  const date = new Date(input)
  if (!Number.isNaN(date.getTime())) {
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${mm}-${dd}`
  }
  return input.slice(0, 10)
}

export function formatSignedNumber(value: number, digits = 2) {
  const fixed = value.toFixed(digits)
  return value > 0 ? `+${fixed}` : fixed
}

export function derivePnlMetrics(series: StrategyEquityPoint[], initialCapital: number) {
  if (!series.length) {
    return {
      totalPnlAmount: 0,
      totalAmount: Number(initialCapital.toFixed(2)),
      todayPnlAmount: 0,
    }
  }

  const first = series[0].value
  const last = series[series.length - 1].value
  const totalPnlAmount = Number((last - first).toFixed(2))
  const totalAmount = Number((initialCapital + totalPnlAmount).toFixed(2))

  const lastDayKey = toDayKey(series[series.length - 1].ts)
  const todayPoints = series.filter(item => toDayKey(item.ts) === lastDayKey)
  const todayPnlAmount = todayPoints.length >= 2
    ? Number((todayPoints[todayPoints.length - 1].value - todayPoints[0].value).toFixed(2))
    : 0

  return {
    totalPnlAmount,
    totalAmount,
    todayPnlAmount,
  }
}

export function deriveAdjacentChangePct(series: StrategyEquityPoint[], index: number) {
  if (index <= 0 || index >= series.length) return null
  const prev = series[index - 1].value
  if (!prev) return null
  const curr = series[index].value
  return Number((((curr - prev) / prev) * 100).toFixed(2))
}
