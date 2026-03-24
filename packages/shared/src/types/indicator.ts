import type { MarketBarPayload, MarketTimeframe } from './market-data'
import { IndicatorType } from '../generated/prisma-enums'

export type IndicatorParamsByType = {
  [K in IndicatorType]: WindowedIndicatorParams
}

export interface WindowedIndicatorParams {
  window: number
}

export interface IndicatorComputeContext {
  symbol: string
  timeframe: MarketTimeframe
  bars: MarketBarPayload[]
}

export type IndicatorNumericValue = number

interface IndicatorCalculatorInstance<T extends IndicatorType> {
  type: T
  compute: (ctx: IndicatorComputeContext, params: IndicatorParamsByType[T]) => IndicatorNumericValue | null
}

const calculators: { [K in IndicatorType]: IndicatorCalculatorInstance<K> } = {
  [IndicatorType.RET]: {
    type: IndicatorType.RET,
    compute: (ctx, params) => computeReturn(ctx.bars, params.window),
  },
  [IndicatorType.MOVING_AVG]: {
    type: IndicatorType.MOVING_AVG,
    compute: (ctx, params) => computeMovingAverage(ctx.bars, params.window),
  },
  [IndicatorType.VOLATILITY]: {
    type: IndicatorType.VOLATILITY,
    compute: (ctx, params) => computeVolatility(ctx.bars, params.window),
  },
  [IndicatorType.VOLUME_RATIO]: {
    type: IndicatorType.VOLUME_RATIO,
    compute: (ctx, params) => computeVolumeRatio(ctx.bars, params.window),
  },
}

export function computeIndicator<T extends IndicatorType>(
  type: T,
  ctx: IndicatorComputeContext,
  params: IndicatorParamsByType[T],
): IndicatorNumericValue | null {
  const calculator = calculators[type] as IndicatorCalculatorInstance<T>
  return calculator.compute(ctx, params)
}

function ensureSufficientBars(bars: MarketBarPayload[], window: number): MarketBarPayload[] | null {
  if (!Number.isFinite(window) || window <= 0) return null
  if (bars.length < window + 1) return null
  return bars.slice(-1 * (window + 1))
}

function safeParseFloat(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function computeReturn(bars: MarketBarPayload[], window: number): IndicatorNumericValue | null {
  const sliced = ensureSufficientBars(bars, window)
  if (!sliced) return null

  const first = sliced[0]
  const last = sliced[sliced.length - 1]
  const c0 = safeParseFloat(first.close)
  const c1 = safeParseFloat(last.close)
  if (c0 === null || c1 === null || c0 === 0) return null

  return (c1 - c0) / c0
}

function computeMovingAverage(bars: MarketBarPayload[], window: number): IndicatorNumericValue | null {
  if (!Number.isFinite(window) || window <= 0) return null
  if (bars.length < window) return null

  const sliced = bars.slice(-window)
  let sum = 0
  let count = 0

  for (const bar of sliced) {
    const close = safeParseFloat(bar.close)
    if (close === null) continue
    sum += close
    count += 1
  }

  if (count === 0) return null
  return sum / count
}

function computeVolatility(bars: MarketBarPayload[], window: number): IndicatorNumericValue | null {
  const sliced = ensureSufficientBars(bars, window)
  if (!sliced) return null

  const logReturns: number[] = []

  for (let i = 1; i < sliced.length; i += 1) {
    const prev = safeParseFloat(sliced[i - 1]?.close)
    const curr = safeParseFloat(sliced[i]?.close)
    if (prev === null || curr === null || prev === 0) continue
    logReturns.push(Math.log(curr / prev))
  }

  if (!logReturns.length) return null

  const mean = logReturns.reduce((acc, v) => acc + v, 0) / logReturns.length
  const variance =
    logReturns.reduce((acc, v) => {
      const diff = v - mean
      return acc + diff * diff
    }, 0) / logReturns.length

  if (!Number.isFinite(variance) || variance < 0) return null
  return Math.sqrt(variance)
}

function computeVolumeRatio(bars: MarketBarPayload[], window: number): IndicatorNumericValue | null {
  const sliced = ensureSufficientBars(bars, window)
  if (!sliced) return null

  const last = sliced[sliced.length - 1]
  const currentVolume = safeParseFloat(last.volume ?? last.quoteVolume ?? undefined)
  if (currentVolume === null) return null

  let sum = 0
  let count = 0

  for (let i = 0; i < sliced.length - 1; i += 1) {
    const vol = safeParseFloat(sliced[i]?.volume ?? sliced[i]?.quoteVolume ?? undefined)
    if (vol === null) continue
    sum += vol
    count += 1
  }

  if (count === 0) return null
  const avg = sum / count
  if (avg === 0) return null

  return currentVolume / avg
}


