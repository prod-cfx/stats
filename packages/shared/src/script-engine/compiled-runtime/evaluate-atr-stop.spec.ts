import type { Bar } from '../helpers/technical-indicators'
import { evaluateAtrTrailingStop } from './evaluate-atr-stop'

/**
 * 构造一组 bar：close 起步 100，每根 +delta 漂移；high/low 围绕 close 形成固定波幅 swing。
 * swing 控制每根的 true range（≈ 2*swing），从而控制 ATR。
 */
function buildBars(length: number, opts: { startClose?: number; delta?: number; swing?: number } = {}): Bar[] {
  const startClose = opts.startClose ?? 100
  const delta = opts.delta ?? 0
  const swing = opts.swing ?? 1
  const bars: Bar[] = []
  for (let i = 0; i < length; i++) {
    const close = startClose + delta * i
    bars.push({
      open: close - delta / 2,
      high: close + swing,
      low: close - swing,
      close,
      volume: 100,
      timestamp: 1_000_000 + i * 60_000,
    })
  }
  return bars
}

describe('evaluateAtrTrailingStop', () => {
  it('returns no-breach when qty=0', () => {
    const bars = buildBars(30, { delta: 0.5 })
    const result = evaluateAtrTrailingStop({
      qty: 0,
      currentPrice: bars[bars.length - 1]!.close,
      entryPrice: 100,
      barsHeld: 10,
      multiplier: 2,
      period: 14,
      bars,
    })
    expect(result.breached).toBe(false)
    expect(result.stopPrice).toBeNull()
  })

  it('returns no-breach when bars insufficient for ATR period', () => {
    const bars = buildBars(10, { delta: 0.5 })
    const result = evaluateAtrTrailingStop({
      qty: 1,
      currentPrice: bars[bars.length - 1]!.close,
      entryPrice: 100,
      barsHeld: 5,
      multiplier: 2,
      period: 14,
      bars,
    })
    expect(result.breached).toBe(false)
    expect(result.stopPrice).toBeNull()
  })

  it('long position: trail stop trails up as close rises, no breach while price stays above', () => {
    // 30 根 bar，连涨：close 从 100 涨到 100 + 29*1 = 129；ATR ≈ 2（swing=1，TR≈2）
    const bars = buildBars(30, { delta: 1, swing: 1 })
    const last = bars[bars.length - 1]!
    const result = evaluateAtrTrailingStop({
      qty: 1,
      currentPrice: last.close,
      entryPrice: 100,
      barsHeld: 20,
      multiplier: 2,
      period: 14,
      bars,
    })
    expect(result.atrValue).not.toBeNull()
    // stop ≈ lastClose - 2 * atr ≈ 129 - 4 = 125 左右，且 low = close - 1 = 128 仍高于 stop
    expect(result.stopPrice).not.toBeNull()
    expect(result.stopPrice!).toBeGreaterThan(100) // trailed up from entry
    expect(result.stopPrice!).toBeLessThan(last.close)
    expect(result.breached).toBe(false)
  })

  it('long position: breaches when last bar low crosses below the trailed stop', () => {
    // 先涨 20 根抬升 trail stop，然后最后一根价格暴跌穿过 stop
    const upBars = buildBars(20, { delta: 1, swing: 1 })
    const lastUp = upBars[upBars.length - 1]!
    // 暴跌一根：close = lastUp.close - 20（直接砸穿 trail stop）
    const crashClose = lastUp.close - 20
    const crashBar: Bar = {
      open: lastUp.close,
      high: lastUp.close,
      low: crashClose,
      close: crashClose,
      volume: 100,
      timestamp: lastUp.timestamp + 60_000,
    }
    const bars = [...upBars, crashBar]
    const result = evaluateAtrTrailingStop({
      qty: 1,
      currentPrice: crashClose,
      entryPrice: 100,
      barsHeld: 20,
      multiplier: 2,
      period: 14,
      bars,
    })
    expect(result.breached).toBe(true)
    expect(result.stopPrice).not.toBeNull()
    expect(crashBar.low).toBeLessThanOrEqual(result.stopPrice!)
  })

  it('short position: trail stop trails down as close falls; breach when high crosses above', () => {
    // 连跌 20 根：close 从 100 降到 80；ATR ≈ 2
    const downBars = buildBars(20, { delta: -1, swing: 1, startClose: 100 })
    const lastDown = downBars[downBars.length - 1]!
    // 暴涨一根：high = lastDown.close + 20 砸穿空头 trail stop
    const spikeClose = lastDown.close + 20
    const spikeBar: Bar = {
      open: lastDown.close,
      high: spikeClose,
      low: lastDown.close,
      close: spikeClose,
      volume: 100,
      timestamp: lastDown.timestamp + 60_000,
    }
    const bars = [...downBars, spikeBar]
    const result = evaluateAtrTrailingStop({
      qty: -1,
      currentPrice: spikeClose,
      entryPrice: 100,
      barsHeld: 20,
      multiplier: 2,
      period: 14,
      bars,
    })
    expect(result.breached).toBe(true)
    expect(result.stopPrice).not.toBeNull()
    expect(spikeBar.high).toBeGreaterThanOrEqual(result.stopPrice!)
  })

  it('rejects invalid multiplier (<=0)', () => {
    const bars = buildBars(30, { delta: 0.5 })
    const result = evaluateAtrTrailingStop({
      qty: 1,
      currentPrice: bars[bars.length - 1]!.close,
      entryPrice: 100,
      barsHeld: 10,
      multiplier: 0,
      period: 14,
      bars,
    })
    expect(result.breached).toBe(false)
    expect(result.stopPrice).toBeNull()
  })

  it('rejects invalid period (non-integer or <=0)', () => {
    const bars = buildBars(30, { delta: 0.5 })
    const result = evaluateAtrTrailingStop({
      qty: 1,
      currentPrice: bars[bars.length - 1]!.close,
      entryPrice: 100,
      barsHeld: 10,
      multiplier: 2,
      period: 0,
      bars,
    })
    expect(result.breached).toBe(false)
    expect(result.stopPrice).toBeNull()
  })
})
