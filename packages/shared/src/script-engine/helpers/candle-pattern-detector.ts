import type { Bar } from './technical-indicators'

export type CandlePattern = 'engulfing' | 'hammer' | 'doji' | 'consecutive_body'
export type CandlePatternDirection = 'bullish' | 'bearish'

export interface CandlePatternDetectorInput {
  pattern: CandlePattern
  direction: CandlePatternDirection
  minBars?: number
}

interface CandleBody {
  low: number
  high: number
  size: number
}

export function candlePatternDetector(
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  input: CandlePatternDetectorInput,
): boolean {
  if (bars.length === 0) return false

  switch (input.pattern) {
    case 'engulfing':
      return detectsEngulfing(bars, input.direction)
    case 'hammer':
      return detectsHammer(bars, input.direction)
    case 'doji':
      return detectsDoji(bars, input.direction)
    case 'consecutive_body':
      return detectsConsecutiveBody(bars, input.direction, input.minBars)
  }
}

function detectsEngulfing(
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  direction: CandlePatternDirection,
): boolean {
  if (bars.length < 2) return false

  const previous = bars[bars.length - 2]!
  const current = bars[bars.length - 1]!
  if (!isValidBar(previous) || !isValidBar(current)) return false

  const previousBody = realBody(previous)
  const currentBody = realBody(current)
  if (previousBody.size === 0 || currentBody.size === 0) return false

  if (direction === 'bullish') {
    return isBearish(previous)
      && isBullish(current)
      && currentBody.low <= previousBody.low
      && currentBody.high >= previousBody.high
  }

  return isBullish(previous)
    && isBearish(current)
    && currentBody.low <= previousBody.low
    && currentBody.high >= previousBody.high
}

function detectsHammer(
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  direction: CandlePatternDirection,
): boolean {
  const current = bars[bars.length - 1]
  if (!current) return false
  if (!isValidBar(current)) return false

  const range = current.high - current.low
  const body = realBody(current)
  if (range <= 0 || body.size <= 0) return false

  const upperShadow = current.high - body.high
  const lowerShadow = body.low - current.low
  const bodyInUpperHalf = body.low >= current.low + range / 2
  const directionMatches = direction === 'bullish' ? isBullish(current) : isBearish(current)

  return directionMatches
    && lowerShadow / body.size >= 2
    && upperShadow / body.size <= 0.3
    && bodyInUpperHalf
}

function detectsDoji(
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  direction: CandlePatternDirection,
): boolean {
  const current = bars[bars.length - 1]
  if (!current) return false
  if (!isValidBar(current)) return false

  const range = current.high - current.low
  if (range <= 0) return false

  const bodyRatio = Math.abs(current.open - current.close) / range
  if (bodyRatio > 0.1) return false

  return direction === 'bullish'
    ? current.close >= current.open
    : current.close <= current.open
}

function detectsConsecutiveBody(
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  direction: CandlePatternDirection,
  minBars: number | undefined,
): boolean {
  if (!Number.isInteger(minBars) || minBars === undefined || minBars <= 0) return false
  if (bars.length < minBars) return false

  const window = bars.slice(bars.length - minBars)
  if (!window.every(isValidBar)) return false

  return direction === 'bullish'
    ? window.every(isBullish)
    : window.every(isBearish)
}

function realBody(bar: Pick<Bar, 'open' | 'close'>): CandleBody {
  return {
    low: Math.min(bar.open, bar.close),
    high: Math.max(bar.open, bar.close),
    size: Math.abs(bar.close - bar.open),
  }
}

function isBullish(bar: Pick<Bar, 'open' | 'close'>): boolean {
  return bar.close > bar.open
}

function isBearish(bar: Pick<Bar, 'open' | 'close'>): boolean {
  return bar.close < bar.open
}

function isValidBar(bar: Pick<Bar, 'open' | 'high' | 'low' | 'close'>): boolean {
  return Number.isFinite(bar.open)
    && Number.isFinite(bar.high)
    && Number.isFinite(bar.low)
    && Number.isFinite(bar.close)
    && bar.high >= Math.max(bar.open, bar.close)
    && bar.low <= Math.min(bar.open, bar.close)
}
