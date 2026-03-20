/**
 * 金融计算辅助函数
 * 专门用于量化交易和金融分析的函数库
 */

/**
 * 计算简单收益率
 * @param initialValue 初始价值
 * @param finalValue 最终价值
 * @returns 收益率（小数形式，如 0.05 表示 5%）
 */
export function simpleReturn(initialValue: number, finalValue: number): number | null {
  if (initialValue <= 0) return null
  return (finalValue - initialValue) / initialValue
}

/**
 * 计算对数收益率
 * @param initialValue 初始价值
 * @param finalValue 最终价值
 * @returns 对数收益率
 */
export function logReturn(initialValue: number, finalValue: number): number | null {
  if (initialValue <= 0 || finalValue <= 0) return null
  return Math.log(finalValue / initialValue)
}

/**
 * 计算一系列价格的收益率
 * @param prices 价格数组
 * @param useLog 是否使用对数收益率，默认 false
 * @returns 收益率数组
 */
export function returns(prices: number[], useLog = false): number[] {
  if (!Array.isArray(prices) || prices.length < 2) return []
  
  const result: number[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!
    const curr = prices[i]!
    
    if (prev <= 0 || (useLog && curr <= 0)) continue
    
    if (useLog) {
      result.push(Math.log(curr / prev))
    }
    else {
      result.push((curr - prev) / prev)
    }
  }
  
  return result
}

/**
 * 计算年化收益率
 * @param returns 收益率数组
 * @param periodsPerYear 每年的周期数（日线252，小时线252*24等）
 * @returns 年化收益率
 */
export function annualizedReturn(returns: number[], periodsPerYear = 252): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  
  const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1)
  const periods = returns.length
  
  return (totalReturn ** (periodsPerYear / periods)) - 1
}

/**
 * 计算年化波动率
 * @param returns 收益率数组
 * @param periodsPerYear 每年的周期数
 * @returns 年化波动率
 */
export function annualizedVolatility(returns: number[], periodsPerYear = 252): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  return stdDev * Math.sqrt(periodsPerYear)
}

/**
 * 计算夏普比率
 * @param returns 收益率数组
 * @param riskFreeRate 无风险利率（年化）
 * @param periodsPerYear 每年的周期数
 * @returns 夏普比率
 */
export function sharpeRatio(
  returns: number[],
  riskFreeRate = 0,
  periodsPerYear = 252,
): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return null
  
  const annualizedAvgReturn = avgReturn * periodsPerYear
  const annualizedStdDev = stdDev * Math.sqrt(periodsPerYear)
  
  return (annualizedAvgReturn - riskFreeRate) / annualizedStdDev
}

/**
 * 计算索提诺比率（只考虑下行波动率）
 * @param returns 收益率数组
 * @param riskFreeRate 无风险利率（年化）
 * @param periodsPerYear 每年的周期数
 * @returns 索提诺比率
 */
export function sortinoRatio(
  returns: number[],
  riskFreeRate = 0,
  periodsPerYear = 252,
): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  
  // 只考虑负收益的波动率
  const downside = returns.filter(r => r < 0)
  if (downside.length === 0) return null
  
  const downsideVariance = downside.reduce((sum, r) => sum + r ** 2, 0) / downside.length
  const downsideStdDev = Math.sqrt(downsideVariance)
  
  if (downsideStdDev === 0) return null
  
  const annualizedAvgReturn = avgReturn * periodsPerYear
  const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(periodsPerYear)
  
  return (annualizedAvgReturn - riskFreeRate) / annualizedDownsideStdDev
}

/**
 * 计算最大回撤
 * @param equity 权益曲线数组
 * @returns 包含最大回撤信息的对象：{ maxDrawdown: 回撤比例, peak: 峰值, trough: 谷值, peakIndex: 峰值索引, troughIndex: 谷值索引 }
 */
export function maxDrawdown(equity: number[]): {
  maxDrawdown: number
  peak: number
  trough: number
  peakIndex: number
  troughIndex: number
} | null {
  if (!Array.isArray(equity) || equity.length === 0) return null
  
  let maxEquity = equity[0]!
  let maxDD = 0
  let peak = 0
  let trough = 0
  let peakIndex = 0
  let troughIndex = 0
  
  for (let i = 0; i < equity.length; i++) {
    const value = equity[i]!
    
    if (value > maxEquity) {
      maxEquity = value
      peakIndex = i
    }
    
    const drawdown = (maxEquity - value) / maxEquity
    
    if (drawdown > maxDD) {
      maxDD = drawdown
      peak = maxEquity
      trough = value
      troughIndex = i
    }
  }
  
  return {
    maxDrawdown: maxDD,
    peak,
    trough,
    peakIndex,
    troughIndex,
  }
}

/**
 * 计算 Calmar 比率（年化收益 / 最大回撤）
 * @param returns 收益率数组
 * @param periodsPerYear 每年的周期数
 * @returns Calmar 比率
 */
export function calmarRatio(returns: number[], periodsPerYear = 252): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  
  const annReturn = annualizedReturn(returns, periodsPerYear)
  if (annReturn === null) return null
  
  // 计算权益曲线
  const equity = [1]
  for (const r of returns) {
    equity.push(equity[equity.length - 1]! * (1 + r))
  }
  
  const mdd = maxDrawdown(equity)
  if (mdd === null || mdd.maxDrawdown === 0) return null
  
  return annReturn / mdd.maxDrawdown
}

/**
 * 计算 Value at Risk (VaR)
 * @param returns 收益率数组
 * @param confidence 置信水平（如 0.95）
 * @returns VaR 值（负数表示损失）
 */
export function valueAtRisk(returns: number[], confidence = 0.95): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  if (confidence <= 0 || confidence >= 1) return null
  
  const sorted = [...returns].sort((a, b) => a - b)
  const index = Math.floor((1 - confidence) * sorted.length)
  
  return sorted[index] ?? null
}

/**
 * 计算 Conditional Value at Risk (CVaR / Expected Shortfall)
 * @param returns 收益率数组
 * @param confidence 置信水平（如 0.95）
 * @returns CVaR 值（负数表示损失）
 */
export function conditionalVaR(returns: number[], confidence = 0.95): number | null {
  if (!Array.isArray(returns) || returns.length === 0) return null
  if (confidence <= 0 || confidence >= 1) return null
  
  const sorted = [...returns].sort((a, b) => a - b)
  const index = Math.floor((1 - confidence) * sorted.length)
  
  // CVaR 是 VaR 之下所有损失的平均值
  const tail = sorted.slice(0, index + 1)
  if (tail.length === 0) return null
  
  return tail.reduce((sum, r) => sum + r, 0) / tail.length
}

/**
 * 计算贝塔系数（相对于基准的系统性风险）
 * @param returns 资产收益率数组
 * @param benchmarkReturns 基准收益率数组
 * @returns 贝塔系数
 */
export function beta(returns: number[], benchmarkReturns: number[]): number | null {
  if (!Array.isArray(returns) || !Array.isArray(benchmarkReturns)) return null
  if (returns.length !== benchmarkReturns.length || returns.length === 0) return null
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const avgBenchmark = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length
  
  let covariance = 0
  let benchmarkVariance = 0
  
  for (let i = 0; i < returns.length; i++) {
    covariance += (returns[i]! - avgReturn) * (benchmarkReturns[i]! - avgBenchmark)
    benchmarkVariance += (benchmarkReturns[i]! - avgBenchmark) ** 2
  }
  
  covariance /= returns.length
  benchmarkVariance /= benchmarkReturns.length
  
  if (benchmarkVariance === 0) return null
  
  return covariance / benchmarkVariance
}

/**
 * 计算阿尔法收益（超额收益）
 * @param returns 资产收益率数组
 * @param benchmarkReturns 基准收益率数组
 * @param riskFreeRate 无风险利率
 * @returns 阿尔法收益
 */
export function alpha(
  returns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0,
): number | null {
  const betaValue = beta(returns, benchmarkReturns)
  if (betaValue === null) return null
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const avgBenchmark = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length
  
  return avgReturn - riskFreeRate - betaValue * (avgBenchmark - riskFreeRate)
}

/**
 * 计算信息比率
 * @param returns 资产收益率数组
 * @param benchmarkReturns 基准收益率数组
 * @returns 信息比率
 */
export function informationRatio(returns: number[], benchmarkReturns: number[]): number | null {
  if (!Array.isArray(returns) || !Array.isArray(benchmarkReturns)) return null
  if (returns.length !== benchmarkReturns.length || returns.length === 0) return null
  
  const activeReturns = returns.map((r, i) => r - benchmarkReturns[i]!)
  const avgActiveReturn = activeReturns.reduce((sum, r) => sum + r, 0) / activeReturns.length
  
  const variance = activeReturns.reduce((sum, r) => sum + (r - avgActiveReturn) ** 2, 0) / activeReturns.length
  const trackingError = Math.sqrt(variance)
  
  if (trackingError === 0) return null
  
  return avgActiveReturn / trackingError
}

/**
 * 计算复利终值
 * @param principal 本金
 * @param rate 利率（如 0.05 表示 5%）
 * @param periods 期数
 * @returns 终值
 */
export function compoundInterest(principal: number, rate: number, periods: number): number {
  return principal * (1 + rate) ** periods
}

/**
 * 计算连续复利终值
 * @param principal 本金
 * @param rate 年利率
 * @param years 年数
 * @returns 终值
 */
export function continuousCompounding(principal: number, rate: number, years: number): number {
  return principal * Math.exp(rate * years)
}

/**
 * 计算胜率
 * @param trades 交易结果数组（正数为盈利，负数为亏损）
 * @returns 胜率（0-1）
 */
export function winRate(trades: number[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) return null
  
  const wins = trades.filter(t => t > 0).length
  return wins / trades.length
}

/**
 * 计算盈亏比（平均盈利 / 平均亏损）
 * @param trades 交易结果数组
 * @returns 盈亏比
 */
export function profitFactor(trades: number[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) return null
  
  const profits = trades.filter(t => t > 0)
  const losses = trades.filter(t => t < 0)
  
  if (losses.length === 0) return null
  
  const totalProfit = profits.reduce((sum, p) => sum + p, 0)
  const totalLoss = Math.abs(losses.reduce((sum, l) => sum + l, 0))
  
  if (totalLoss === 0) return null
  
  return totalProfit / totalLoss
}

/**
 * 计算期望收益
 * @param trades 交易结果数组
 * @returns 平均每笔交易的期望收益
 */
export function expectancy(trades: number[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) return null
  
  return trades.reduce((sum, t) => sum + t, 0) / trades.length
}

/**
 * 计算凯利公式最优仓位
 * @param winRate 胜率（0-1）
 * @param avgWin 平均盈利
 * @param avgLoss 平均亏损（正数）
 * @returns 建议仓位百分比（0-1）
 */
export function kellyPercentage(winRate: number, avgWin: number, avgLoss: number): number | null {
  if (winRate <= 0 || winRate >= 1 || avgLoss <= 0) return null
  
  const lossRate = 1 - winRate
  const winLossRatio = avgWin / avgLoss
  
  const kelly = (winRate * winLossRatio - lossRate) / winLossRatio
  
  // 凯利公式可能给出负值（不应该交易）或过大值（需要限制）
  return Math.max(0, Math.min(kelly, 0.25)) // 最大 25%
}

/**
 * 计算破产概率（简化版，使用凯利公式）
 * @param winRate 胜率
 * @param avgWin 平均盈利
 * @param avgLoss 平均亏损
 * @param riskPerTrade 每笔交易风险百分比
 * @returns 破产概率（0-1）
 */
export function riskOfRuin(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  riskPerTrade: number,
): number | null {
  if (winRate <= 0 || winRate >= 1 || avgLoss <= 0 || riskPerTrade <= 0) return null
  
  const lossRate = 1 - winRate
  const advantagePerTrade = winRate * avgWin - lossRate * avgLoss
  
  if (advantagePerTrade <= 0) return 1 // 负期望值，必然破产
  
  // 简化计算：使用近似公式
  const ratio = avgLoss / avgWin
  return ((lossRate / winRate) * ratio) ** (1 / riskPerTrade)
}
