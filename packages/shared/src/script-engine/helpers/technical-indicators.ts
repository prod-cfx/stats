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
