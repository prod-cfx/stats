import type { Bar } from '@ai/shared/script-engine/helpers/technical-indicators'

export interface GatewayBarLike {
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  timestamp: number
  isFinal?: boolean
}

export interface RuntimeBar extends Bar {
  isFinal: boolean
}

export function normalizeGatewayBar(bar: GatewayBarLike): RuntimeBar {
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
    timestamp: bar.timestamp,
    isFinal: bar.isFinal ?? true,
  }
}

export function normalizeGatewayBars(bars: readonly GatewayBarLike[]): RuntimeBar[] {
  return bars.map(normalizeGatewayBar)
}
