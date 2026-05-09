/**
 * 技术指标辅助函数
 * 用于量化交易策略中的技术分析
 */

/**
 * K线数据结构
 */
export interface Bar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface PricePivotPoint {
  index: number
  value: number
}

export interface PriceHighsLowsResult {
  highs: PricePivotPoint[]
  lows: PricePivotPoint[]
}

export type ChartPatternKind = 'head_and_shoulders' | 'double_top' | 'double_bottom' | 'triangle'
export type ChartPatternDirection = 'bullish' | 'bearish'

export interface ChartPatternDetectorOptions {
  pivotWindow?: number
  confirmationBars?: number
  tolerancePct?: number
  minBreakoutPct?: number
  minSwingPct?: number
  lookbackBars?: number
}

/**
 * 检测价格 pivot high/low。
 *
 * pivotWindow 控制左侧历史窗口，confirmationBars 控制右侧确认窗口。
 * 当右侧可用 K 线少于 confirmationBars 时，按当前已知 K 线做实时确认，
 * 因此 backtest/runtime 不需要读取未来数据。
 */
export function priceHighsLows(
  bars: Bar[],
  pivotWindow: number,
  confirmationBars = 0,
): PriceHighsLowsResult {
  const leftWindow = Math.max(1, Math.floor(pivotWindow))
  const rightWindow = Math.max(0, Math.floor(confirmationBars))
  const result: PriceHighsLowsResult = { highs: [], lows: [] }

  if (!Array.isArray(bars) || bars.length < leftWindow + 1) {
    return result
  }

  for (let index = leftWindow; index < bars.length; index += 1) {
    const bar = bars[index]
    if (!bar) continue

    const left = bars.slice(index - leftWindow, index)
    const right = bars.slice(index + 1, Math.min(bars.length, index + rightWindow + 1))

    if (Number.isFinite(bar.high)) {
      const higherOnLeft = left.some(item => item.high >= bar.high)
      const higherOnRight = right.some(item => item.high > bar.high)
      if (!higherOnLeft && !higherOnRight) {
        result.highs.push({ index, value: bar.high })
      }
    }

    if (Number.isFinite(bar.low)) {
      const lowerOnLeft = left.some(item => item.low <= bar.low)
      const lowerOnRight = right.some(item => item.low < bar.low)
      if (!lowerOnLeft && !lowerOnRight) {
        result.lows.push({ index, value: bar.low })
      }
    }
  }

  return result
}

/**
 * 基于价格 pivot 的图形形态检测。
 *
 * 返回 1/0 以便 compiled runtime 直接通过 EQ(series, 1) 消费。
 */
export function chartPatternDetector(
  bars: Bar[],
  pattern: ChartPatternKind,
  direction: ChartPatternDirection,
  options: ChartPatternDetectorOptions = {},
): number {
  const pivotWindow = Math.max(1, Math.floor(options.pivotWindow ?? 2))
  const confirmationBars = Math.max(0, Math.floor(options.confirmationBars ?? 1))
  const lookbackBars = Math.max(pivotWindow + confirmationBars + 2, Math.floor(options.lookbackBars ?? 80))
  const tolerancePct = nonNegativeFinite(options.tolerancePct, 0.04)
  const minBreakoutPct = nonNegativeFinite(options.minBreakoutPct, 0)
  const minSwingPct = nonNegativeFinite(options.minSwingPct, 0.02)

  if (!Array.isArray(bars) || bars.length < pivotWindow + confirmationBars + 3) {
    return 0
  }
  if (!isSupportedChartPattern(pattern, direction)) {
    return 0
  }

  const windowStart = Math.max(0, bars.length - lookbackBars)
  const windowBars = bars.slice(windowStart)
  const pivots = priceHighsLows(windowBars, pivotWindow, confirmationBars)
  const normalizedPivots: PriceHighsLowsResult = {
    highs: pivots.highs.map(pivot => ({ index: pivot.index + windowStart, value: pivot.value })),
    lows: pivots.lows.map(pivot => ({ index: pivot.index + windowStart, value: pivot.value })),
  }

  const current = bars[bars.length - 1]
  if (!current || !Number.isFinite(current.close)) return 0

  const matched = (() => {
    if (pattern === 'head_and_shoulders') {
      return direction === 'bearish'
        ? hasBearishHeadAndShoulders(bars, normalizedPivots, tolerancePct, minBreakoutPct, minSwingPct)
        : hasBullishHeadAndShoulders(bars, normalizedPivots, tolerancePct, minBreakoutPct, minSwingPct)
    }
    if (pattern === 'double_top') {
      return direction === 'bearish'
        && hasDoubleTop(bars, normalizedPivots, tolerancePct, minBreakoutPct, minSwingPct)
    }
    if (pattern === 'double_bottom') {
      return direction === 'bullish'
        && hasDoubleBottom(bars, normalizedPivots, tolerancePct, minBreakoutPct, minSwingPct)
    }
    return hasTriangleBreakout(bars, normalizedPivots, direction, minBreakoutPct, minSwingPct)
  })()

  return matched ? 1 : 0
}

function isSupportedChartPattern(pattern: ChartPatternKind, direction: ChartPatternDirection): boolean {
  if (pattern === 'double_top') return direction === 'bearish'
  if (pattern === 'double_bottom') return direction === 'bullish'
  return pattern === 'head_and_shoulders' || pattern === 'triangle'
}

function hasBearishHeadAndShoulders(
  bars: Bar[],
  pivots: PriceHighsLowsResult,
  tolerancePct: number,
  minBreakoutPct: number,
  minSwingPct: number,
): boolean {
  for (const [left, head, right] of latestPivotTriples(pivots.highs)) {
    if (!isNear(left.value, right.value, tolerancePct)) continue
    if (head.value <= left.value * (1 + minSwingPct) || head.value <= right.value * (1 + minSwingPct)) continue

    const leftNeck = lowestPivotBetween(pivots.lows, left.index, head.index)
    const rightNeck = lowestPivotBetween(pivots.lows, head.index, right.index)
    if (!leftNeck || !rightNeck) continue
    if (!hasSwingDepth(head.value, Math.min(leftNeck.value, rightNeck.value), minSwingPct)) continue

    if (crossedBelowLine(bars, leftNeck, rightNeck, minBreakoutPct, right.index)) {
      return true
    }
  }
  return false
}

function hasBullishHeadAndShoulders(
  bars: Bar[],
  pivots: PriceHighsLowsResult,
  tolerancePct: number,
  minBreakoutPct: number,
  minSwingPct: number,
): boolean {
  for (const [left, head, right] of latestPivotTriples(pivots.lows)) {
    if (!isNear(left.value, right.value, tolerancePct)) continue
    if (head.value >= left.value * (1 - minSwingPct) || head.value >= right.value * (1 - minSwingPct)) continue

    const leftNeck = highestPivotBetween(pivots.highs, left.index, head.index)
    const rightNeck = highestPivotBetween(pivots.highs, head.index, right.index)
    if (!leftNeck || !rightNeck) continue
    if (!hasSwingDepth(Math.max(leftNeck.value, rightNeck.value), head.value, minSwingPct)) continue

    if (crossedAboveLine(bars, leftNeck, rightNeck, minBreakoutPct, right.index)) {
      return true
    }
  }
  return false
}

function hasDoubleTop(
  bars: Bar[],
  pivots: PriceHighsLowsResult,
  tolerancePct: number,
  minBreakoutPct: number,
  minSwingPct: number,
): boolean {
  for (const [left, right] of latestPivotPairs(pivots.highs)) {
    if (!isNear(left.value, right.value, tolerancePct)) continue
    const neckline = lowestPivotBetween(pivots.lows, left.index, right.index)
    if (!neckline) continue
    if (!hasSwingDepth(Math.min(left.value, right.value), neckline.value, minSwingPct)) continue
    if (crossedBelowLevel(bars, neckline.value, minBreakoutPct, right.index)) {
      return true
    }
  }
  return false
}

function hasDoubleBottom(
  bars: Bar[],
  pivots: PriceHighsLowsResult,
  tolerancePct: number,
  minBreakoutPct: number,
  minSwingPct: number,
): boolean {
  for (const [left, right] of latestPivotPairs(pivots.lows)) {
    if (!isNear(left.value, right.value, tolerancePct)) continue
    const neckline = highestPivotBetween(pivots.highs, left.index, right.index)
    if (!neckline) continue
    if (!hasSwingDepth(neckline.value, Math.max(left.value, right.value), minSwingPct)) continue
    if (crossedAboveLevel(bars, neckline.value, minBreakoutPct, right.index)) {
      return true
    }
  }
  return false
}

function hasTriangleBreakout(
  bars: Bar[],
  pivots: PriceHighsLowsResult,
  direction: ChartPatternDirection,
  minBreakoutPct: number,
  minSwingPct: number,
): boolean {
  const latestIndex = bars.length - 1
  const highs = pivots.highs.filter(pivot => pivot.index < latestIndex)
  const lows = pivots.lows.filter(pivot => pivot.index < latestIndex)
  if (highs.length < 2 || lows.length < 2) return false

  const highA = highs[highs.length - 2]!
  const highB = highs[highs.length - 1]!
  const lowA = lows[lows.length - 2]!
  const lowB = lows[lows.length - 1]!
  if (highA.index === highB.index || lowA.index === lowB.index) return false

  const resistanceSlope = (highB.value - highA.value) / (highB.index - highA.index)
  const supportSlope = (lowB.value - lowA.value) / (lowB.index - lowA.index)
  if (resistanceSlope >= supportSlope) return false

  const firstGap = highA.value - lowA.value
  const latestResistance = interpolateLine(highA, highB, latestIndex)
  const latestSupport = interpolateLine(lowA, lowB, latestIndex)
  if (latestResistance === null || latestSupport === null) return false

  const latestGap = latestResistance - latestSupport
  if (!Number.isFinite(firstGap) || !Number.isFinite(latestGap) || firstGap <= 0 || latestGap <= 0) return false
  if (latestGap >= firstGap * 0.85) return false
  if (!hasSwingDepth(highA.value, lowA.value, minSwingPct)) return false

  const structureEndIndex = Math.max(highB.index, lowB.index)
  return direction === 'bullish'
    ? crossedAboveLine(bars, highA, highB, minBreakoutPct, structureEndIndex)
    : crossedBelowLine(bars, lowA, lowB, minBreakoutPct, structureEndIndex)
}

function crossedAboveLine(
  bars: readonly Bar[],
  left: PricePivotPoint,
  right: PricePivotPoint,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  return crossedAboveDynamicThreshold(
    bars,
    index => interpolateLine(left, right, index),
    minBreakoutPct,
    structureEndIndex,
  )
}

function crossedBelowLine(
  bars: readonly Bar[],
  left: PricePivotPoint,
  right: PricePivotPoint,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  return crossedBelowDynamicThreshold(
    bars,
    index => interpolateLine(left, right, index),
    minBreakoutPct,
    structureEndIndex,
  )
}

function crossedAboveLevel(
  bars: readonly Bar[],
  level: number,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  return crossedAboveDynamicThreshold(bars, () => level, minBreakoutPct, structureEndIndex)
}

function crossedBelowLevel(
  bars: readonly Bar[],
  level: number,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  return crossedBelowDynamicThreshold(bars, () => level, minBreakoutPct, structureEndIndex)
}

function crossedAboveDynamicThreshold(
  bars: readonly Bar[],
  thresholdAt: (index: number) => number | null,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  const latestIndex = bars.length - 1
  if (!crossedAboveAt(bars, thresholdAt, minBreakoutPct, latestIndex)) return false
  for (let index = Math.max(1, structureEndIndex + 1); index < latestIndex; index += 1) {
    if (crossedAboveAt(bars, thresholdAt, minBreakoutPct, index)) return false
  }
  return true
}

function crossedBelowDynamicThreshold(
  bars: readonly Bar[],
  thresholdAt: (index: number) => number | null,
  minBreakoutPct: number,
  structureEndIndex: number,
): boolean {
  const latestIndex = bars.length - 1
  if (!crossedBelowAt(bars, thresholdAt, minBreakoutPct, latestIndex)) return false
  for (let index = Math.max(1, structureEndIndex + 1); index < latestIndex; index += 1) {
    if (crossedBelowAt(bars, thresholdAt, minBreakoutPct, index)) return false
  }
  return true
}

function crossedAboveAt(
  bars: readonly Bar[],
  thresholdAt: (index: number) => number | null,
  minBreakoutPct: number,
  index: number,
): boolean {
  const current = bars[index]?.close
  const previous = bars[index - 1]?.close
  const currentThreshold = thresholdAt(index)
  const previousThreshold = thresholdAt(index - 1)
  if (typeof current !== 'number' || !Number.isFinite(current)) return false
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return false
  if (currentThreshold === null || previousThreshold === null) return false
  return current > currentThreshold * (1 + minBreakoutPct)
    && previous <= previousThreshold * (1 + minBreakoutPct)
}

function crossedBelowAt(
  bars: readonly Bar[],
  thresholdAt: (index: number) => number | null,
  minBreakoutPct: number,
  index: number,
): boolean {
  const current = bars[index]?.close
  const previous = bars[index - 1]?.close
  const currentThreshold = thresholdAt(index)
  const previousThreshold = thresholdAt(index - 1)
  if (typeof current !== 'number' || !Number.isFinite(current)) return false
  if (typeof previous !== 'number' || !Number.isFinite(previous)) return false
  if (currentThreshold === null || previousThreshold === null) return false
  return current < currentThreshold * (1 - minBreakoutPct)
    && previous >= previousThreshold * (1 - minBreakoutPct)
}

function latestPivotPairs(pivots: PricePivotPoint[]): Array<[PricePivotPoint, PricePivotPoint]> {
  const pairs: Array<[PricePivotPoint, PricePivotPoint]> = []
  for (let rightIndex = pivots.length - 1; rightIndex >= 1; rightIndex -= 1) {
    pairs.push([pivots[rightIndex - 1]!, pivots[rightIndex]!])
  }
  return pairs
}

function latestPivotTriples(pivots: PricePivotPoint[]): Array<[PricePivotPoint, PricePivotPoint, PricePivotPoint]> {
  const triples: Array<[PricePivotPoint, PricePivotPoint, PricePivotPoint]> = []
  for (let rightIndex = pivots.length - 1; rightIndex >= 2; rightIndex -= 1) {
    triples.push([pivots[rightIndex - 2]!, pivots[rightIndex - 1]!, pivots[rightIndex]!])
  }
  return triples
}

function highestPivotBetween(pivots: PricePivotPoint[], start: number, end: number): PricePivotPoint | null {
  return bestPivotBetween(pivots, start, end, (left, right) => left.value > right.value)
}

function lowestPivotBetween(pivots: PricePivotPoint[], start: number, end: number): PricePivotPoint | null {
  return bestPivotBetween(pivots, start, end, (left, right) => left.value < right.value)
}

function bestPivotBetween(
  pivots: PricePivotPoint[],
  start: number,
  end: number,
  better: (left: PricePivotPoint, right: PricePivotPoint) => boolean,
): PricePivotPoint | null {
  let best: PricePivotPoint | null = null
  for (const pivot of pivots) {
    if (pivot.index <= start || pivot.index >= end) continue
    if (!best || better(pivot, best)) best = pivot
  }
  return best
}

function interpolateLine(left: PricePivotPoint, right: PricePivotPoint, index: number): number | null {
  const width = right.index - left.index
  if (width === 0) return null
  return left.value + ((right.value - left.value) * (index - left.index)) / width
}

function isNear(left: number, right: number, tolerancePct: number): boolean {
  const base = Math.max(Math.abs(left), Math.abs(right), 1)
  return Math.abs(left - right) / base <= tolerancePct
}

function hasSwingDepth(high: number, low: number, minSwingPct: number): boolean {
  if (high <= low) return false
  return (high - low) / Math.max(Math.abs(high), 1) >= minSwingPct
}

function nonNegativeFinite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * 简单移动平均线 (SMA)
 */
export function sma(prices: number[], period: number): number | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period) {
    return null
  }
  
  const slice = prices.slice(-period)
  const sum = slice.reduce((acc, val) => acc + val, 0)
  return sum / period
}

/**
 * 成交量简单移动平均线 (SMA Volume)
 */
export function smaVolume(bars: Bar[], period: number): number | null {
  if (!Array.isArray(bars) || period <= 0 || bars.length < period) {
    return null
  }

  return sma(bars.map(bar => bar.volume), period)
}

/**
 * 指数移动平均线 (EMA)
 */
export function ema(prices: number[], period: number): number | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length === 0) {
    return null
  }
  
  const multiplier = 2 / (period + 1)
  let ema = prices[0]!
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i]! - ema) * multiplier + ema
  }
  
  return ema
}

/**
 * 计算 EMA 序列
 */
export function emaArray(prices: number[], period: number): number[] {
  if (!Array.isArray(prices) || period <= 0 || prices.length === 0) {
    return []
  }
  
  const multiplier = 2 / (period + 1)
  const result: number[] = []
  let ema = prices[0]!
  result.push(ema)
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i]! - ema) * multiplier + ema
    result.push(ema)
  }
  
  return result
}

/**
 * MACD 指标
 * @returns { macd, signal, histogram } 或 null
 */
export function macd(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: number, signal: number, histogram: number } | null {
  if (!Array.isArray(prices) || prices.length < slowPeriod + signalPeriod) {
    return null
  }
  
  const fastEMA = emaArray(prices, fastPeriod)
  const slowEMA = emaArray(prices, slowPeriod)
  
  if (fastEMA.length === 0 || slowEMA.length === 0) return null
  
  // MACD 线
  const macdLine: number[] = []
  for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
    macdLine.push(fastEMA[i]! - slowEMA[i]!)
  }
  
  // 信号线
  const signalLine = emaArray(macdLine, signalPeriod)
  
  if (signalLine.length === 0) return null
  
  const macdValue = macdLine[macdLine.length - 1]!
  const signalValue = signalLine[signalLine.length - 1]!
  
  return {
    macd: macdValue,
    signal: signalValue,
    histogram: macdValue - signalValue,
  }
}

/**
 * 相对强弱指标 (RSI)
 */
export function rsi(prices: number[], period = 14): number | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period + 1) {
    return null
  }
  
  const changes: number[] = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i]! - prices[i - 1]!)
  }
  
  const gains: number[] = []
  const losses: number[] = []
  
  for (const change of changes) {
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? -change : 0)
  }
  
  // 计算平均涨幅和跌幅
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]!) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period
  }
  
  if (avgLoss === 0) return 100
  
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/**
 * 布林带 (Bollinger Bands)
 */
export function bollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): { upper: number, middle: number, lower: number } | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period) {
    return null
  }
  
  const slice = prices.slice(-period)
  const middle = slice.reduce((sum, val) => sum + val, 0) / period
  
  const variance = slice.reduce((sum, val) => sum + (val - middle)**2, 0) / period
  const std = Math.sqrt(variance)
  
  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
  }
}

/**
 * 真实波幅 (ATR)
 */
export function atr(bars: Bar[], period = 14): number | null {
  if (!Array.isArray(bars) || bars.length < period + 1) {
    return null
  }
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i]!.high
    const low = bars[i]!.low
    const prevClose = bars[i - 1]!.close
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    )
    
    trueRanges.push(tr)
  }
  
  // 计算 ATR（使用 Wilder's smoothing）
  if (trueRanges.length < period) return null
  
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]!) / period
  }
  
  return atr
}

/**
 * 随机指标 (Stochastic Oscillator)
 */
export function stochastic(
  bars: Bar[],
  kPeriod = 14,
  _dPeriod = 3,
): { k: number, d: number } | null {
  if (!Array.isArray(bars) || bars.length < kPeriod) {
    return null
  }
  
  const slice = bars.slice(-kPeriod)
  const currentClose = slice[slice.length - 1]!.close
  const lowestLow = Math.min(...slice.map(b => b.low))
  const highestHigh = Math.max(...slice.map(b => b.high))
  
  if (highestHigh === lowestLow) return null
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
  
  // 计算 %D（%K 的移动平均）
  // 简化版：只返回当前 %K，完整实现需要历史 %K 值
  const d = k // 简化实现
  
  return { k, d }
}

/**
 * 能量潮 (OBV)
 */
export function obv(bars: Bar[]): number | null {
  if (!Array.isArray(bars) || bars.length < 2) {
    return null
  }
  
  let obv = 0
  
  for (let i = 1; i < bars.length; i++) {
    const currentClose = bars[i]!.close
    const prevClose = bars[i - 1]!.close
    const volume = bars[i]!.volume
    
    if (currentClose > prevClose) {
      obv += volume
    }
    else if (currentClose < prevClose) {
      obv -= volume
    }
    // 如果价格相同，OBV 不变
  }
  
  return obv
}

/**
 * 成交量加权平均价 (VWAP)
 */
export function vwap(bars: Bar[]): number | null {
  if (!Array.isArray(bars) || bars.length === 0) {
    return null
  }
  
  let totalPV = 0
  let totalVolume = 0
  
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3
    totalPV += typicalPrice * bar.volume
    totalVolume += bar.volume
  }
  
  if (totalVolume === 0) return null
  
  return totalPV / totalVolume
}

/**
 * 动量指标 (Momentum)
 */
export function momentum(prices: number[], period = 10): number | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period + 1) {
    return null
  }
  
  const current = prices[prices.length - 1]!
  const past = prices[prices.length - 1 - period]!
  
  return current - past
}

/**
 * 变化率 (Rate of Change)
 */
export function roc(prices: number[], period = 10): number | null {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period + 1) {
    return null
  }
  
  const current = prices[prices.length - 1]!
  const past = prices[prices.length - 1 - period]!
  
  if (past === 0) return null
  
  return ((current - past) / past) * 100
}

/**
 * 威廉指标 (%R)
 */
export function williamsR(bars: Bar[], period = 14): number | null {
  if (!Array.isArray(bars) || bars.length < period) {
    return null
  }
  
  const slice = bars.slice(-period)
  const currentClose = slice[slice.length - 1]!.close
  const highestHigh = Math.max(...slice.map(b => b.high))
  const lowestLow = Math.min(...slice.map(b => b.low))
  
  if (highestHigh === lowestLow) return null
  
  return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100
}

/**
 * 商品通道指标 (CCI)
 */
export function cci(bars: Bar[], period = 20): number | null {
  if (!Array.isArray(bars) || bars.length < period) {
    return null
  }
  
  const slice = bars.slice(-period)
  
  // 计算典型价格
  const typicalPrices = slice.map(b => (b.high + b.low + b.close) / 3)
  
  // 计算 SMA
  const sma = typicalPrices.reduce((sum, val) => sum + val, 0) / period
  
  // 计算平均偏差
  const meanDeviation = typicalPrices.reduce((sum, val) => sum + Math.abs(val - sma), 0) / period
  
  if (meanDeviation === 0) return null
  
  const currentTP = typicalPrices[typicalPrices.length - 1]!
  
  return (currentTP - sma) / (0.015 * meanDeviation)
}

/**
 * 平均方向指数 (ADX) - 简化版
 */
export function adx(bars: Bar[], period = 14): number | null {
  if (!Array.isArray(bars) || bars.length < period + 1) {
    return null
  }
  
  // 这是 ADX 的简化实现
  // 完整实现需要计算 +DI, -DI, DX 等
  const dmPlus: number[] = []
  const dmMinus: number[] = []
  const tr: number[] = []
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i]!.high
    const low = bars[i]!.low
    const prevHigh = bars[i - 1]!.high
    const prevLow = bars[i - 1]!.low
    const prevClose = bars[i - 1]!.close
    
    const highDiff = high - prevHigh
    const lowDiff = prevLow - low
    
    dmPlus.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0)
    dmMinus.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0)
    
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }
  
  if (tr.length < period) return null
  
  // 简化：返回平均真实波幅作为趋势强度的近似
  const avgTR = tr.slice(-period).reduce((sum, val) => sum + val, 0) / period
  const avgDMPlus = dmPlus.slice(-period).reduce((sum, val) => sum + val, 0) / period
  const avgDMMinus = dmMinus.slice(-period).reduce((sum, val) => sum + val, 0) / period
  
  if (avgTR === 0) return null
  
  const diPlus = (avgDMPlus / avgTR) * 100
  const diMinus = (avgDMMinus / avgTR) * 100
  
  if (diPlus + diMinus === 0) return null
  
  const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100
  
  return dx
}
