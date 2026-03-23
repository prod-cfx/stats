/**
 * 策略上下文构建器
 * 将辅助函数安全地注入到脚本执行上下文中
 */

import type {
  LegTimeframeData,
  MultiLegStrategyContext,
  StrategyContext,
  StrategyHelpers,
  StrategyParamsNormalized,
} from './helpers.types'
import { getSafeHelpers } from './safe-helpers'

/**
 * 构建策略执行上下文（旧版，单 Leg 单周期）
 * @deprecated 使用 buildMultiLegStrategyContext 替代
 */
export function buildStrategyContext(context: StrategyContext): Record<string, unknown> {
  const paramsNormalized = normalizeStrategyParams(context.params)
  return {
    // 市场数据
    bars: context.bars,
    symbol: context.symbol,
    timeframe: context.timeframe,
    indicators: context.indicators,
    currentPrice: context.currentPrice,
    timestamp: context.timestamp,

    // 策略参数（来自模板 defaultParams 或实例 params）
    params: context.params ?? null,
    paramsNormalized,

    // 辅助函数对象（已做安全处理、只读）
    helpers: getSafeHelpers(),
  }
}

/**
 * 构建多 Leg 多周期策略执行上下文（新版）
 * 
 * @param context 多 Leg 策略上下文
 * @returns 包含所有 leg 和 timeframe 数据的脚本上下文
 */
export function buildMultiLegStrategyContext(context: MultiLegStrategyContext): Record<string, unknown> {
  const paramsNormalized = normalizeStrategyParams(context.params)
  // 查找 primary leg（用于向后兼容）
  const primaryLeg = context.legs.find(leg => leg.role === 'primary')
  const primaryLegId = primaryLeg?.id
  const primaryTimeframe = context.execution.timeframe
  
  // 为向后兼容，提供主 leg 的快捷访问
  let compatibilityData: {
    bars?: unknown
    symbol?: string
    timeframe?: string
    indicators?: Record<string, number>
    currentPrice?: number
  } = {}
  
  if (primaryLegId && context.data[primaryLegId]?.[primaryTimeframe]) {
    const primaryData = context.data[primaryLegId][primaryTimeframe]
    compatibilityData = {
      bars: primaryData.bars,
      symbol: primaryLeg.symbol,
      timeframe: primaryTimeframe,
      indicators: primaryData.indicators,
      currentPrice: primaryData.currentPrice,
    }
  }
  
  return {
    // 新版：按 leg 和 timeframe 索引的数据
    data: context.data,
    
    // 策略配置
    execution: context.execution,
    legs: context.legs,
    dataRequirements: context.dataRequirements,
    
    // 时间戳
    timestamp: context.timestamp,

    // 策略参数（来自模板 defaultParams 或实例 params）
    params: context.params ?? null,
    paramsNormalized,
    
    // 向后兼容：主 leg 的快捷访问
    ...compatibilityData,

    // 辅助函数（安全克隆，脚本内只读）
    helpers: getSafeHelpers(),
  }
}

function normalizeStrategyParams(params: Record<string, unknown> | null | undefined): StrategyParamsNormalized {
  const source = params && typeof params === 'object' && !Array.isArray(params)
    ? params
    : {}

  return {
    riskPct: readNumber(source.riskPct),
    positionPct: readNumber(source.positionPct),
    stopLossPct: readNumber(source.stopLossPct),
    takeProfitPct: readNumber(source.takeProfitPct),
    maxDrawdownPct: readNumber(source.maxDrawdownPct),
    leverage: readNumber(source.leverage),
    allowShort: readBoolean(source.allowShort),
  }
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/**
 * 获取辅助函数库的类型定义（用于 TypeScript）
 */
export type { LegTimeframeData, MultiLegStrategyContext, StrategyContext, StrategyHelpers }

/**
 * 获取可用的全局变量和函数列表（用于文档生成）
 */
export function getAvailableGlobals(): string[] {
  return [
    // 数据
    'bars',
    'symbol',
    'timeframe',
    'indicators',
    'currentPrice',
    'timestamp',
    'data', // 多 leg 数据
    'execution', // 执行配置
    'legs', // Leg 定义
    'dataRequirements', // 数据需求
    
    // 辅助函数命名空间
    'helpers.finance.*',
    'helpers.array.*',
    'helpers.ta.*',
    'helpers.signal.*',
    
    // VM 原生对象（由 Node VM 自动提供）
    'Math',
    'Date',
    'JSON',
    'Array',
    'Object',
    'String',
    'Number',
    'Boolean',
  ]
}

/**
 * 验证策略脚本返回的信号格式
 */
export function validateSignalResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') {
    return false
  }
  
  const signal = result as Record<string, unknown>
  
  // 必需字段
  if (!signal.direction || typeof signal.direction !== 'string') {
    return false
  }
  
  const validDirections = ['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT']
  if (!validDirections.includes(signal.direction as string)) {
    return false
  }
  
  // signalType 是可选的，但如果存在必须有效
  if (signal.signalType) {
    const validTypes = ['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT']
    if (!validTypes.includes(signal.signalType as string)) {
      return false
    }
  }
  
  return true
}

/**
 * 创建策略脚本模板
 */
export function createStrategyTemplate(): string {
  return `// 策略脚本模板
// 可用的上下文变量：bars, symbol, timeframe, indicators, currentPrice, helpers

// 1. 获取价格数据
const closes = bars.map(b => b.close)
const highs = bars.map(b => b.high)
const lows = bars.map(b => b.low)
const volumes = bars.map(b => b.volume)

// 2. 计算技术指标
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)
const rsi14 = helpers.ta.rsi(closes, 14)
const atr14 = helpers.ta.atr(bars, 14)

// 3. 计算金融指标（可选）
const returns = helpers.finance.returns(closes)
const sharpe = helpers.finance.sharpeRatio(returns, 0, 252)

// 4. 判断信号条件
if (sma20 && sma50 && helpers.signal.crossOver([sma20], [sma50])) {
  // 金叉：买入信号
  const entryPrice = currentPrice || closes[closes.length - 1]
  const stopLoss = helpers.signal.calcStopLoss(entryPrice, atr14 || 100, 2, 'BUY')
  const takeProfit = helpers.signal.calcTakeProfit(entryPrice, stopLoss, 2, 'BUY')
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 80,
    entryPrice,
    stopLoss,
    takeProfit,
    reasoning: \`SMA20 金叉 SMA50，RSI: \${rsi14?.toFixed(2)}, Sharpe: \${sharpe?.toFixed(2)}\`
  }
}

// 5. 如果没有信号，返回 null
return null
`
}

/**
 * 创建简单的示例脚本
 */
export function createExampleScript(type: 'ma-cross' | 'rsi-reversal' | 'breakout'): string {
  switch (type) {
    case 'ma-cross':
      return `// 双均线交叉策略
const closes = bars.map(b => b.close)
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)

if (sma20 && sma50) {
  const sma20Array = closes.map((_, i) => helpers.ta.sma(closes.slice(0, i + 1), 20)).filter(v => v !== null)
  const sma50Array = closes.map((_, i) => helpers.ta.sma(closes.slice(0, i + 1), 50)).filter(v => v !== null)
  
  if (helpers.signal.crossOver(sma20Array, sma50Array)) {
    return {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 75,
      entryPrice: currentPrice,
      reasoning: 'Golden cross detected'
    }
  }
  
  if (helpers.signal.crossUnder(sma20Array, sma50Array)) {
    return {
      direction: 'SELL',
      signalType: 'ENTRY',
      confidence: 75,
      entryPrice: currentPrice,
      reasoning: 'Death cross detected'
    }
  }
}

return null
`

    case 'rsi-reversal':
      return `// RSI 超买超卖策略
const closes = bars.map(b => b.close)
const rsi14 = helpers.ta.rsi(closes, 14)

if (rsi14 === null) return null

if (helpers.signal.isOversold(rsi14, 30)) {
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    reasoning: \`RSI oversold at \${rsi14.toFixed(2)}\`
  }
}

if (helpers.signal.isOverbought(rsi14, 70)) {
  return {
    direction: 'SELL',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    reasoning: \`RSI overbought at \${rsi14.toFixed(2)}\`
  }
}

return null
`

    case 'breakout':
      return `// 突破策略
const closes = bars.map(b => b.close)
const highs = bars.map(b => b.high)
const lows = bars.map(b => b.low)

const period = 20
const highestHigh = helpers.signal.highest(highs, period)
const lowestLow = helpers.signal.lowest(lows, period)

if (highestHigh === null || lowestLow === null) return null

const currentPrice = closes[closes.length - 1]
const atr14 = helpers.ta.atr(bars, 14)

// 向上突破
if (currentPrice > highestHigh) {
  const stopLoss = helpers.signal.calcStopLoss(currentPrice, atr14 || 100, 2, 'BUY')
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 80,
    entryPrice: currentPrice,
    stopLoss,
    reasoning: \`Breakout above \${period}-period high\`
  }
}

// 向下突破
if (currentPrice < lowestLow) {
  const stopLoss = helpers.signal.calcStopLoss(currentPrice, atr14 || 100, 2, 'SELL')
  
  return {
    direction: 'SELL',
    signalType: 'ENTRY',
    confidence: 80,
    entryPrice: currentPrice,
    stopLoss,
    reasoning: \`Breakdown below \${period}-period low\`
  }
}

return null
`

    default:
      return createStrategyTemplate()
  }
}
