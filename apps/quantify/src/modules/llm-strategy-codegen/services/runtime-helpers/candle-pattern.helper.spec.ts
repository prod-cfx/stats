import { candlePatternDetector, type CandlePattern, type CandlePatternDirection } from './candle-pattern.helper'

interface TestBar {
  open: number
  high: number
  low: number
  close: number
}

function bar(open: number, high: number, low: number, close: number): TestBar {
  return { open, high, low, close }
}

const patternFixtures: Record<CandlePattern, Record<CandlePatternDirection, TestBar[]>> = {
  engulfing: {
    bullish: [
      bar(10, 10.5, 7.5, 8),
      bar(7.8, 11, 7.5, 10.6),
    ],
    bearish: [
      bar(8, 10.5, 7.5, 10),
      bar(10.2, 10.5, 7.5, 7.8),
    ],
  },
  hammer: {
    bullish: [bar(10, 11.2, 7.8, 11)],
    bearish: [bar(11, 11.2, 7.8, 10)],
  },
  doji: {
    bullish: [bar(10, 10.5, 9.5, 10.05)],
    bearish: [bar(10.05, 10.5, 9.5, 10)],
  },
  consecutive_body: {
    bullish: [
      bar(10, 11, 9.8, 10.6),
      bar(10.6, 11.2, 10.4, 11),
      bar(11, 11.8, 10.9, 11.5),
    ],
    bearish: [
      bar(11.5, 11.8, 10.9, 11),
      bar(11, 11.2, 10.4, 10.6),
      bar(10.6, 11, 9.8, 10),
    ],
  },
  // Issue #1391：单根阳/阴线 — close > open / close < open
  single_bull_bar: {
    bullish: [bar(10, 10.8, 9.9, 10.5)],
    bearish: [bar(10, 10.8, 9.9, 10.5)],
  },
  single_bear_bar: {
    bullish: [bar(10.5, 10.8, 9.9, 10)],
    bearish: [bar(10.5, 10.8, 9.9, 10)],
  },
}

describe('candlePatternDetector', () => {
  it.each([
    ['engulfing', 'bullish'],
    ['engulfing', 'bearish'],
    ['hammer', 'bullish'],
    ['hammer', 'bearish'],
    ['doji', 'bullish'],
    ['doji', 'bearish'],
    ['consecutive_body', 'bullish'],
    ['consecutive_body', 'bearish'],
  ] satisfies Array<[CandlePattern, CandlePatternDirection]>)(
    'detects %s %s',
    (pattern, direction) => {
      expect(candlePatternDetector(patternFixtures[pattern][direction], {
        pattern,
        direction,
        ...(pattern === 'consecutive_body' ? { minBars: 3 } : {}),
      })).toBe(true)
    },
  )

  it.each([2, 3, 5])('respects consecutive_body minBars=%i boundary', (minBars) => {
    const bullishBars = Array.from({ length: minBars }, (_unused, index) =>
      bar(10 + index, 11 + index, 9.8 + index, 10.6 + index))
    const brokenBars = [
      ...bullishBars.slice(0, minBars - 1),
      bar(20, 20.5, 19, 19.4),
    ]

    expect(candlePatternDetector(bullishBars.slice(0, minBars - 1), {
      pattern: 'consecutive_body',
      direction: 'bullish',
      minBars,
    })).toBe(false)
    expect(candlePatternDetector(bullishBars, {
      pattern: 'consecutive_body',
      direction: 'bullish',
      minBars,
    })).toBe(true)
    expect(candlePatternDetector(brokenBars, {
      pattern: 'consecutive_body',
      direction: 'bullish',
      minBars,
    })).toBe(false)
  })
})
