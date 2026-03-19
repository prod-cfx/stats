import type { Bar } from '@ai/shared/script-engine/helpers/technical-indicators'

export interface GatewayBarLike {
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  timestamp: number
}

export function normalizeGatewayBar(bar: GatewayBarLike): Bar {
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
    timestamp: bar.timestamp,
  }
}

export function normalizeGatewayBars(bars: readonly GatewayBarLike[]): Bar[] {
  return bars.map(normalizeGatewayBar)
}
