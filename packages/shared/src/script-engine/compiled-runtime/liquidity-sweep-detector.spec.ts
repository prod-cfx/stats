import { liquiditySweepDetector } from './liquidity-sweep-detector'

function bar(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
) {
  return { timestamp, open, high, low, close, volume: 1 }
}

const t = (hour: number, minute = 0, day = 1) => Date.UTC(2026, 0, day, hour, minute)

describe('liquiditySweepDetector', () => {
  it.each([
    {
      name: 'prev_low bullish',
      direction: 'bullish',
      reference: 'prev_low',
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 100.5, 98.5, 99.5),
      ],
    },
    {
      name: 'prev_high bearish',
      direction: 'bearish',
      reference: 'prev_high',
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 101.5, 99.5, 100.5),
      ],
    },
    {
      name: 'session_low bullish',
      direction: 'bullish',
      reference: 'session_low',
      bars: [
        bar(t(23, 45, 1), 100, 101, 70, 100),
        bar(t(0, 0, 2), 100, 101, 100, 100.5),
        bar(t(0, 15, 2), 100.5, 101, 99, 100),
        bar(t(0, 30, 2), 100, 100.5, 98, 99.5),
      ],
    },
    {
      name: 'session_high bearish',
      direction: 'bearish',
      reference: 'session_high',
      bars: [
        bar(t(23, 45, 1), 100, 130, 99, 100),
        bar(t(0, 0, 2), 100, 100, 99, 99.5),
        bar(t(0, 15, 2), 99.5, 101, 99, 100),
        bar(t(0, 30, 2), 100, 102, 99.5, 100.5),
      ],
    },
  ])('accepts natural sweep combination: $name', ({ direction, reference, bars }) => {
    expect(liquiditySweepDetector({ bars, direction, reference, reclaimBars: 3 })).toBe(true)
  })

  it.each([
    { direction: 'bullish', reference: 'prev_high' },
    { direction: 'bullish', reference: 'session_high' },
    { direction: 'bearish', reference: 'prev_low' },
    { direction: 'bearish', reference: 'session_low' },
  ])('rejects contradictory combination $direction × $reference', ({ direction, reference }) => {
    expect(liquiditySweepDetector({
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 102, 98, 100),
      ],
      direction,
      reference,
      reclaimBars: 3,
    })).toBe(false)
  })

  it('accepts immediate reclaim on the sweep bar', () => {
    expect(liquiditySweepDetector({
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 100.5, 98.5, 99.2),
      ],
      direction: 'bullish',
      reference: 'prev_low',
      reclaimBars: 3,
    })).toBe(true)
  })

  it('accepts reclaim on the Nth bar', () => {
    expect(liquiditySweepDetector({
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 100.5, 98.5, 98.7),
        bar(t(0, 30), 98.7, 99, 98.4, 98.8),
        bar(t(0, 45), 98.8, 99, 98.6, 98.9),
        bar(t(1), 98.9, 99.4, 98.8, 99.2),
      ],
      direction: 'bullish',
      reference: 'prev_low',
      reclaimBars: 3,
    })).toBe(true)
  })

  it('fails closed when price never reclaims within reclaimBars', () => {
    expect(liquiditySweepDetector({
      bars: [
        bar(t(0), 100, 101, 99, 100),
        bar(t(0, 15), 100, 100.5, 98.5, 98.7),
        bar(t(0, 30), 98.7, 99, 98.4, 98.8),
        bar(t(0, 45), 98.8, 99, 98.6, 98.9),
      ],
      direction: 'bullish',
      reference: 'prev_low',
      reclaimBars: 2,
    })).toBe(false)
  })
})
