import type { Bar } from '@/modules/backtesting/types/backtesting.types'

export interface RuntimeScriptBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export function getClosedBarsAsOf<T extends { closeTime: number }>(bars: readonly T[], ts: number): readonly T[] {
  const last = bars[bars.length - 1]
  if (!last) return []
  if (last.closeTime <= ts) return bars

  let left = 0
  let right = bars.length
  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (bars[mid]!.closeTime <= ts) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  return bars.slice(0, left)
}

export function toRuntimeScriptBars(bars: readonly Bar[]): RuntimeScriptBar[] {
  return bars.map(bar => ({
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    timestamp: bar.closeTime,
  }))
}
