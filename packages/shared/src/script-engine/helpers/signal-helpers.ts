/**
 * 信号生成和条件判断辅助函数
 */

import type { Bar } from './technical-indicators'
import { type SignalDirection, SignalType } from '../../generated/prisma-enums'

/**
 * 信号对象
 */
export interface Signal {
  direction: SignalDirection
  signalType: SignalType
  confidence?: number
  entryPrice?: number
  stopLoss?: number
  takeProfit?: number
  reasoning?: string
}

/**
 * 创建信号对象
 */
export function createSignal(params: {
  direction: SignalDirection
  signalType?: SignalType
  confidence?: number
  entryPrice?: number
  stopLoss?: number
  takeProfit?: number
  reasoning?: string
}): Signal {
  return {
    direction: params.direction,
    signalType: params.signalType || SignalType.ENTRY,
    confidence: params.confidence,
    entryPrice: params.entryPrice,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    reasoning: params.reasoning,
  }
}

/**
 * 判断上穿（crossover）
 * 当 series1 从下方穿过 series2 向上时返回 true
 */
export function crossOver(series1: number[], series2: number[]): boolean {
  if (!Array.isArray(series1) || !Array.isArray(series2)) return false
  if (series1.length < 2 || series2.length < 2) return false
  
  const len = Math.min(series1.length, series2.length)
  const current1 = series1[len - 1]!
  const current2 = series2[len - 1]!
  const prev1 = series1[len - 2]!
  const prev2 = series2[len - 2]!
  
  return prev1 <= prev2 && current1 > current2
}

/**
 * 判断下穿（crossunder）
 * 当 series1 从上方穿过 series2 向下时返回 true
 */
export function crossUnder(series1: number[], series2: number[]): boolean {
  if (!Array.isArray(series1) || !Array.isArray(series2)) return false
  if (series1.length < 2 || series2.length < 2) return false
  
  const len = Math.min(series1.length, series2.length)
  const current1 = series1[len - 1]!
  const current2 = series2[len - 1]!
  const prev1 = series1[len - 2]!
  const prev2 = series2[len - 2]!
  
  return prev1 >= prev2 && current1 < current2
}

/**
 * 获取数组中最近 N 个元素的最高值
 */
export function highest(array: number[], period: number): number | null {
  if (!Array.isArray(array) || period <= 0 || array.length === 0) {
    return null
  }
  
  const slice = array.slice(-period)
  return Math.max(...slice)
}

/**
 * 获取数组中最近 N 个元素的最低值
 */
export function lowest(array: number[], period: number): number | null {
  if (!Array.isArray(array) || period <= 0 || array.length === 0) {
    return null
  }
  
  const slice = array.slice(-period)
  return Math.min(...slice)
}

/**
 * 判断是否连续上涨
 */
export function isRising(array: number[], count: number): boolean {
  if (!Array.isArray(array) || count <= 0 || array.length < count + 1) {
    return false
  }
  
  const slice = array.slice(-count - 1)
  
  for (let i = 1; i < slice.length; i++) {
    if (slice[i]! <= slice[i - 1]!) {
      return false
    }
  }
  
  return true
}

/**
 * 判断是否连续下跌
 */
export function isFalling(array: number[], count: number): boolean {
  if (!Array.isArray(array) || count <= 0 || array.length < count + 1) {
    return false
  }
  
  const slice = array.slice(-count - 1)
  
  for (let i = 1; i < slice.length; i++) {
    if (slice[i]! >= slice[i - 1]!) {
      return false
    }
  }
  
  return true
}

/**
 * 判断价格是否在某个范围内
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * 判断是否超买（RSI > 70）
 */
export function isOverbought(rsi: number, threshold = 70): boolean {
  return rsi > threshold
}

/**
 * 判断是否超卖（RSI < 30）
 */
export function isOversold(rsi: number, threshold = 30): boolean {
  return rsi < threshold
}

/**
 * 计算止损价格（基于 ATR）
 */
export function calcStopLoss(
  entryPrice: number,
  atr: number,
  multiplier = 2,
  direction: 'BUY' | 'SELL' = 'BUY',
): number {
  if (direction === 'BUY') {
    return entryPrice - atr * multiplier
  }
  else {
    return entryPrice + atr * multiplier
  }
}

/**
 * 计算止盈价格（基于风险回报比）
 */
export function calcTakeProfit(
  entryPrice: number,
  stopLoss: number,
  riskRewardRatio = 2,
  direction: 'BUY' | 'SELL' = 'BUY',
): number {
  const risk = Math.abs(entryPrice - stopLoss)
  const reward = risk * riskRewardRatio
  
  if (direction === 'BUY') {
    return entryPrice + reward
  }
  else {
    return entryPrice - reward
  }
}

/**
 * 计算仓位大小（基于风险管理）
 * @param capital 总资金
 * @param riskPercent 风险百分比（如 1 表示 1%）
 * @param entryPrice 入场价格
 * @param stopLoss 止损价格
 * @returns 仓位数量
 */
export function calcPositionSize(
  capital: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
): number {
  if (capital <= 0 || riskPercent <= 0 || entryPrice <= 0) {
    return 0
  }
  
  const riskAmount = capital * (riskPercent / 100)
  const priceRisk = Math.abs(entryPrice - stopLoss)
  
  if (priceRisk === 0) return 0
  
  return riskAmount / priceRisk
}

/**
 * 计算凯利公式仓位
 * @param winRate 胜率 (0-1)
 * @param avgWin 平均盈利
 * @param avgLoss 平均亏损
 * @returns 建议仓位百分比 (0-1)
 */
export function kellyPercentage(
  winRate: number,
  avgWin: number,
  avgLoss: number,
): number {
  if (winRate <= 0 || winRate >= 1 || avgLoss <= 0) {
    return 0
  }
  
  const lossRate = 1 - winRate
  const winLossRatio = avgWin / avgLoss
  
  const kelly = (winRate * winLossRatio - lossRate) / winLossRatio
  
  // 限制在合理范围内
  return Math.max(0, Math.min(kelly, 0.25)) // 最大 25%
}

/**
 * 计算夏普比率
 * @param returns 收益率数组
 * @param riskFreeRate 无风险利率（年化）
 */
export function sharpeRatio(returns: number[], riskFreeRate = 0): number | null {
  if (!Array.isArray(returns) || returns.length === 0) {
    return null
  }
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn)**2, 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return null
  
  return (avgReturn - riskFreeRate) / stdDev
}

/**
 * 计算最大回撤
 * @param equity 权益曲线数组
 */
export function maxDrawdown(equity: number[]): number | null {
  if (!Array.isArray(equity) || equity.length === 0) {
    return null
  }
  
  let maxEquity = equity[0]!
  let maxDD = 0
  
  for (const value of equity) {
    if (value > maxEquity) {
      maxEquity = value
    }
    
    const drawdown = (maxEquity - value) / maxEquity
    if (drawdown > maxDD) {
      maxDD = drawdown
    }
  }
  
  return maxDD
}

/**
 * 计算胜率
 * @param trades 交易结果数组（正数为盈利，负数为亏损）
 */
export function winRate(trades: number[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) {
    return null
  }
  
  const wins = trades.filter(t => t > 0).length
  return wins / trades.length
}

/**
 * 计算盈亏比
 * @param trades 交易结果数组
 */
export function profitFactor(trades: number[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) {
    return null
  }
  
  const profits = trades.filter(t => t > 0)
  const losses = trades.filter(t => t < 0)
  
  if (losses.length === 0) return null
  
  const totalProfit = profits.reduce((sum, p) => sum + p, 0)
  const totalLoss = Math.abs(losses.reduce((sum, l) => sum + l, 0))
  
  if (totalLoss === 0) return null
  
  return totalProfit / totalLoss
}

/**
 * 获取当前价格相对于高低点的位置（0-100）
 */
export function pricePosition(bars: Bar[], period: number): number | null {
  if (!Array.isArray(bars) || bars.length < period || period <= 0) {
    return null
  }
  
  const slice = bars.slice(-period)
  const currentClose = slice[slice.length - 1]!.close
  const high = Math.max(...slice.map(b => b.high))
  const low = Math.min(...slice.map(b => b.low))
  
  if (high === low) return 50
  
  return ((currentClose - low) / (high - low)) * 100
}

/**
 * 判断是否形成金叉
 */
export function goldenCross(fastMA: number[], slowMA: number[]): boolean {
  return crossOver(fastMA, slowMA)
}

/**
 * 判断是否形成死叉
 */
export function deathCross(fastMA: number[], slowMA: number[]): boolean {
  return crossUnder(fastMA, slowMA)
}

/**
 * 判断趋势方向
 * @returns 'UP' | 'DOWN' | 'SIDEWAYS'
 */
export function trendDirection(
  prices: number[],
  period = 20,
): 'UP' | 'DOWN' | 'SIDEWAYS' | null {
  if (!Array.isArray(prices) || prices.length < period) {
    return null
  }
  
  const slice = prices.slice(-period)
  const firstHalf = slice.slice(0, Math.floor(period / 2))
  const secondHalf = slice.slice(Math.floor(period / 2))
  
  const avgFirst = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length
  
  const change = (avgSecond - avgFirst) / avgFirst
  
  if (change > 0.02) return 'UP'      // 上涨超过 2%
  if (change < -0.02) return 'DOWN'   // 下跌超过 2%
  return 'SIDEWAYS'
}
