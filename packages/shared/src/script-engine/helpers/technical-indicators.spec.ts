import type { Bar, ChartPatternDirection, ChartPatternKind } from './technical-indicators'
import { chartPatternDetector } from './technical-indicators'

describe('chartPatternDetector', () => {
  function barsFromCloses(closes: number[]): Bar[] {
    return closes.map((close, index) => ({
      open: close,
      high: close,
      low: close,
      close,
      volume: 1,
      timestamp: index + 1,
    }))
  }

  function detect(
    closes: number[],
    pattern: ChartPatternKind,
    direction: ChartPatternDirection,
  ): number {
    return chartPatternDetector(barsFromCloses(closes), pattern, direction, {
      pivotWindow: 1,
      confirmationBars: 1,
    })
  }

  it.each([
    {
      name: 'head_and_shoulders bearish',
      closes: [100, 112, 104, 124, 103, 111, 98],
      pattern: 'head_and_shoulders' as const,
      direction: 'bearish' as const,
    },
    {
      name: 'head_and_shoulders bullish inverse',
      closes: [120, 108, 116, 96, 117, 109, 123],
      pattern: 'head_and_shoulders' as const,
      direction: 'bullish' as const,
    },
    {
      name: 'double_top bearish',
      closes: [100, 112, 104, 113, 101],
      pattern: 'double_top' as const,
      direction: 'bearish' as const,
    },
    {
      name: 'double_bottom bullish',
      closes: [120, 108, 116, 109, 121],
      pattern: 'double_bottom' as const,
      direction: 'bullish' as const,
    },
    {
      name: 'triangle bullish',
      closes: [110, 120, 100, 116, 104, 121],
      pattern: 'triangle' as const,
      direction: 'bullish' as const,
    },
    {
      name: 'triangle bearish',
      closes: [110, 120, 100, 116, 104, 105],
      pattern: 'triangle' as const,
      direction: 'bearish' as const,
    },
  ])('detects $name from price pivots', ({ closes, pattern, direction }) => {
    expect(detect(closes, pattern, direction)).toBe(1)
  })

  it('returns 0 when lookback is too short to include the pivot structure', () => {
    const bars = barsFromCloses([100, 112, 104, 124, 103, 111, 98])

    expect(chartPatternDetector(bars, 'head_and_shoulders', 'bearish', {
      pivotWindow: 1,
      confirmationBars: 1,
      lookbackBars: 4,
    })).toBe(0)
  })

  it('returns 0 after the breakout bar has already passed', () => {
    const bars = barsFromCloses([100, 112, 104, 124, 103, 111, 98, 97])

    expect(chartPatternDetector(bars, 'head_and_shoulders', 'bearish', {
      pivotWindow: 1,
      confirmationBars: 1,
    })).toBe(0)
  })

  it('returns 0 when an old pattern recrosses after the first breakout', () => {
    const bars = barsFromCloses([100, 112, 104, 124, 103, 111, 98, 106, 97])

    expect(chartPatternDetector(bars, 'head_and_shoulders', 'bearish', {
      pivotWindow: 1,
      confirmationBars: 1,
    })).toBe(0)
  })

  it('returns 0 when pivots are not significant enough', () => {
    const bars = barsFromCloses([100, 102, 101.5, 102.1, 101.4])

    expect(chartPatternDetector(bars, 'double_top', 'bearish', {
      pivotWindow: 1,
      confirmationBars: 1,
      minSwingPct: 0.02,
    })).toBe(0)
  })
})
