/**
 * 辅助函数类型定义和上下文构建器
 */

import type { Bar } from './technical-indicators'

/**
 * 规范化后的策略参数（固定字段，便于脚本获得确定结构）
 */
export interface StrategyParamsNormalized {
  riskPct: number | null
  positionPct: number | null
  stopLossPct: number | null
  takeProfitPct: number | null
  maxDrawdownPct: number | null
  leverage: number | null
  allowShort: boolean | null
}

/**
 * 单个 leg 在单个时间周期的数据
 * 
 * 包含该 leg 在特定时间周期的所有市场数据。
 */
export interface LegTimeframeData {
  /** K线数据数组 */
  bars: Bar[]
  /** 预计算的技术指标值 */
  indicators: Record<string, number>
  /** 当前价格（最新 K 线的收盘价） */
  currentPrice: number
}

/**
 * 单个 leg 的所有时间周期数据
 * 
 * @deprecated 暂未使用，保留供未来扩展
 */
export interface LegData {
  /** 交易对代码 */
  symbol: string
  /** 按时间周期索引的数据 */
  timeframes: Record<string, LegTimeframeData>
}

/**
 * 策略执行上下文（旧版，单 Leg 单周期）
 * 
 * @deprecated 使用 MultiLegStrategyContext 替代
 * 
 * 此上下文仅支持单一交易对和单一时间周期的数据访问。
 * 为保持向后兼容性而保留。
 */
export interface StrategyContext {
  // 市场数据
  /** K线数据数组 */
  bars: Bar[]
  /** 交易对代码，如 "BTCUSDT" */
  symbol: string
  /** 时间周期，如 "1h" */
  timeframe: string

  // 预计算的指标值
  /** 技术指标对象，如 {rsi_14: 45.2, ma_20: 62000} */
  indicators: Record<string, number>

  // 辅助数据
  /** 当前价格 */
  currentPrice?: number
  /** 市场状态门控：行情结构，如 range / trend */
  marketRegime?: string
  /** 市场状态门控：方向，如 up / down / sideways */
  trendDirection?: string
  /** 市场状态门控：波动状态，如 low / high */
  volatilityState?: string
  /** 当前时间戳（毫秒） */
  timestamp?: number
  /**
   * 策略参数（可选）
   *
   * - 来自策略模板的 defaultParams 或策略实例的 params
   * - 允许脚本根据不同实例的配置生成差异化的 promptData
   */
  params?: Record<string, unknown> | null
  /**
   * 规范化策略参数（固定字段，优先使用）
   */
  paramsNormalized?: StrategyParamsNormalized
}

/**
 * 多 Leg 多周期策略执行上下文（新版）
 * 
 * 支持策略同时访问多个交易对（legs）和多个时间周期的数据。
 * 
 * @example 访问数据
 * ```typescript
 * // 访问 BTC 1h 数据
 * const btc1h = data['btc']['1h']
 * const btcPrice = btc1h.currentPrice
 * const btcBars = btc1h.bars
 * 
 * // 访问 ETH 4h 数据
 * const eth4h = data['eth']['4h']
 * 
 * // 策略配置
 * const mainTimeframe = execution.timeframe  // "15m"
 * const cooldown = execution.cooldownMinutes // 15
 * ```
 * 
 * @example 向后兼容访问
 * ```typescript
 * // 旧代码仍可使用（自动指向 primary leg）
 * const price = currentPrice  // 等同于 data[primaryLegId][execution.timeframe].currentPrice
 * const bars = bars           // 等同于 data[primaryLegId][execution.timeframe].bars
 * ```
 */
export interface MultiLegStrategyContext {
  /**
   * 按 leg id 索引的数据，每个 leg 包含多个时间周期的数据
   * 
   * @example
   * ```typescript
   * data[legId][timeframe].bars          // K线数组
   * data[legId][timeframe].indicators    // 指标值
   * data[legId][timeframe].currentPrice  // 当前价格
   * ```
   */
  data: Record<string, Record<string, LegTimeframeData>>
  
  /**
   * 策略执行配置
   */
  execution: {
    /** 信号触发周期 */
    timeframe: string
    /** 冷却时间（分钟） */
    cooldownMinutes?: number
  }
  
  /**
   * 腿配置列表
   */
  legs: Array<{
    /** Leg 唯一标识 */
    id: string
    /** 交易对代码 */
    symbol: string
    /** Leg 角色 */
    role: 'primary' | 'hedge' | 'context'
    /** 可选描述 */
    description?: string
  }>
  
  /**
   * 数据需求配置
   * 
   * @example
   * ```typescript
   * {
   *   "btc": ["15m", "1h", "4h"],
   *   "eth": ["1h"]
   * }
   * ```
   */
  dataRequirements: Record<string, string[]>
  
  /**
   * 当前时间戳（毫秒）
   */
  timestamp: number

  /**
   * 策略参数（可选）
   *
   * - 来自策略模板的 defaultParams 或策略实例的 params
   * - 在多 Leg 策略脚本中可通过 params 访问
   */
  params?: Record<string, unknown> | null
  /**
   * 规范化策略参数（固定字段，优先使用）
   */
  paramsNormalized?: StrategyParamsNormalized

  // 向后兼容：主腿的快捷访问（如果存在 primary leg）
  /**
   * @deprecated 使用 data[primaryLegId][timeframe] 替代
   */
  bars?: Bar[]
  /**
   * @deprecated 使用 legs[0].symbol 替代
   */
  symbol?: string
  /**
   * @deprecated 使用 execution.timeframe 替代
   */
  timeframe?: string
  /**
   * @deprecated 使用 data[primaryLegId][timeframe].indicators 替代
   */
  indicators?: Record<string, number>
  /**
   * @deprecated 使用 data[primaryLegId][timeframe].currentPrice 替代
   */
  currentPrice?: number
}

/**
 * 所有辅助函数的命名空间类型
 */
export interface StrategyHelpers {
  // 金融计算
  finance: {
    simpleReturn: (initial: number, final: number) => number | null
    logReturn: (initial: number, final: number) => number | null
    returns: (prices: number[], useLog?: boolean) => number[]
    annualizedReturn: (returns: number[], periodsPerYear?: number) => number | null
    annualizedVolatility: (returns: number[], periodsPerYear?: number) => number | null
    sharpeRatio: (returns: number[], riskFreeRate?: number, periodsPerYear?: number) => number | null
    sortinoRatio: (returns: number[], riskFreeRate?: number, periodsPerYear?: number) => number | null
    maxDrawdown: (equity: number[]) => any | null
    calmarRatio: (returns: number[], periodsPerYear?: number) => number | null
    valueAtRisk: (returns: number[], confidence?: number) => number | null
    conditionalVaR: (returns: number[], confidence?: number) => number | null
    beta: (returns: number[], benchmarkReturns: number[]) => number | null
    alpha: (returns: number[], benchmarkReturns: number[], riskFreeRate?: number) => number | null
    informationRatio: (returns: number[], benchmarkReturns: number[]) => number | null
    compoundInterest: (principal: number, rate: number, periods: number) => number
    continuousCompounding: (principal: number, rate: number, years: number) => number
    winRate: (trades: number[]) => number | null
    profitFactor: (trades: number[]) => number | null
    expectancy: (trades: number[]) => number | null
    kellyPercentage: (winRate: number, avgWin: number, avgLoss: number) => number | null
    riskOfRuin: (winRate: number, avgWin: number, avgLoss: number, riskPerTrade: number) => number | null
  }
  
  // 数组操作
  array: {
    rolling: <T, R>(array: T[], window: number, fn: (slice: T[]) => R) => R[]
    diff: (array: number[], periods?: number) => number[]
    pctChange: (array: number[], periods?: number) => number[]
    cumsum: (array: number[]) => number[]
    cumprod: (array: number[]) => number[]
    normalize: (array: number[]) => number[]
    standardize: (array: number[]) => number[]
    tail: <T>(array: T[], n: number) => T[]
    head: <T>(array: T[], n: number) => T[]
    shift: <T>(array: T[], periods: number, fillValue?: T) => T[]
  }
  
  // 技术指标
  ta: {
    sma: (prices: number[], period: number) => number | null
    ema: (prices: number[], period: number) => number | null
    emaArray: (prices: number[], period: number) => number[]
    macd: (prices: number[], fast?: number, slow?: number, signal?: number) => { macd: number, signal: number, histogram: number } | null
    rsi: (prices: number[], period?: number) => number | null
    bollingerBands: (prices: number[], period?: number, stdDev?: number) => { upper: number, middle: number, lower: number } | null
    atr: (bars: Bar[], period?: number) => number | null
    smaVolume: (bars: Bar[], period: number) => number | null
    stochastic: (bars: Bar[], kPeriod?: number, dPeriod?: number) => { k: number, d: number } | null
    obv: (bars: Bar[]) => number | null
    vwap: (bars: Bar[]) => number | null
    momentum: (prices: number[], period?: number) => number | null
    roc: (prices: number[], period?: number) => number | null
    williamsR: (bars: Bar[], period?: number) => number | null
    cci: (bars: Bar[], period?: number) => number | null
    adx: (bars: Bar[], period?: number) => number | null
  }
  
  // 信号生成
  signal: {
    createSignal: (params: any) => any
    crossOver: (series1: number[], series2: number[]) => boolean
    crossUnder: (series1: number[], series2: number[]) => boolean
    highest: (array: number[], period: number) => number | null
    lowest: (array: number[], period: number) => number | null
    rollingHigh: (bars: Bar[], period: number) => number | null
    rollingLow: (bars: Bar[], period: number) => number | null
    isRising: (array: number[], count: number) => boolean
    isFalling: (array: number[], count: number) => boolean
    inRange: (value: number, min: number, max: number) => boolean
    isOverbought: (rsi: number, threshold?: number) => boolean
    isOversold: (rsi: number, threshold?: number) => boolean
    calcStopLoss: (entryPrice: number, atr: number, multiplier?: number, direction?: 'BUY' | 'SELL') => number
    calcTakeProfit: (entryPrice: number, stopLoss: number, riskRewardRatio?: number, direction?: 'BUY' | 'SELL') => number
    calcPositionSize: (capital: number, riskPercent: number, entryPrice: number, stopLoss: number) => number
    kellyPercentage: (winRate: number, avgWin: number, avgLoss: number) => number
    sharpeRatio: (returns: number[], riskFreeRate?: number) => number | null
    maxDrawdown: (equity: number[]) => number | null
    winRate: (trades: number[]) => number | null
    profitFactor: (trades: number[]) => number | null
    pricePosition: (bars: Bar[], period: number) => number | null
    goldenCross: (fastMA: number[], slowMA: number[]) => boolean
    deathCross: (fastMA: number[], slowMA: number[]) => boolean
    trendDirection: (prices: number[], period?: number) => 'UP' | 'DOWN' | 'SIDEWAYS' | null
  }
}

/**
 * 辅助函数文档（用于外部调用方展示或消费）
 */
export interface HelperFunctionDoc {
  name: string
  signature: string
  description: string
  example: string
  category: 'finance' | 'array' | 'ta' | 'signal'
  returns: string
}

/**
 * 获取所有辅助函数的文档
 */
export function getHelperDocs(): HelperFunctionDoc[] {
  return [
    // 金融计算函数
    {
      name: 'sharpeRatio',
      signature: 'helpers.finance.sharpeRatio(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number | null',
      description: '计算夏普比率（风险调整后收益指标）',
      example: 'const sharpe = helpers.finance.sharpeRatio(returns, 0.02, 252)',
      category: 'finance',
      returns: '夏普比率或 null',
    },
    {
      name: 'annualizedReturn',
      signature: 'helpers.finance.annualizedReturn(returns: number[], periodsPerYear?: number): number | null',
      description: '计算年化收益率',
      example: 'const annRet = helpers.finance.annualizedReturn(returns, 252)',
      category: 'finance',
      returns: '年化收益率或 null',
    },
    {
      name: 'maxDrawdown',
      signature: 'helpers.finance.maxDrawdown(equity: number[]): object | null',
      description: '计算最大回撤及相关信息',
      example: 'const mdd = helpers.finance.maxDrawdown(equityCurve)',
      category: 'finance',
      returns: '包含 maxDrawdown, peak, trough 等信息的对象',
    },
    {
      name: 'sortinoRatio',
      signature: 'helpers.finance.sortinoRatio(returns: number[], riskFreeRate?: number, periodsPerYear?: number): number | null',
      description: '计算索提诺比率（只考虑下行风险）',
      example: 'const sortino = helpers.finance.sortinoRatio(returns)',
      category: 'finance',
      returns: '索提诺比率或 null',
    },
    {
      name: 'valueAtRisk',
      signature: 'helpers.finance.valueAtRisk(returns: number[], confidence?: number): number | null',
      description: '计算风险价值（VaR）',
      example: 'const var95 = helpers.finance.valueAtRisk(returns, 0.95)',
      category: 'finance',
      returns: 'VaR 值或 null',
    },
    
    // 数组操作
    {
      name: 'diff',
      signature: 'helpers.array.diff(array: number[], periods?: number): number[]',
      description: '计算数组元素的差分',
      example: 'const changes = helpers.array.diff(closes) // [c[1]-c[0], c[2]-c[1], ...]',
      category: 'array',
      returns: '差分数组',
    },
    {
      name: 'pctChange',
      signature: 'helpers.array.pctChange(array: number[], periods?: number): number[]',
      description: '计算百分比变化',
      example: 'const returns = helpers.array.pctChange(closes)',
      category: 'array',
      returns: '百分比变化数组',
    },
    {
      name: 'normalize',
      signature: 'helpers.array.normalize(array: number[]): number[]',
      description: '将数组归一化到 [0, 1] 区间',
      example: 'const normalized = helpers.array.normalize(prices)',
      category: 'array',
      returns: '归一化后的数组',
    },
    
    // 技术指标
    {
      name: 'sma',
      signature: 'helpers.ta.sma(prices: number[], period: number): number | null',
      description: '计算简单移动平均线',
      example: 'const sma20 = helpers.ta.sma(closes, 20)',
      category: 'ta',
      returns: 'SMA 值或 null',
    },
    {
      name: 'ema',
      signature: 'helpers.ta.ema(prices: number[], period: number): number | null',
      description: '计算指数移动平均线',
      example: 'const ema12 = helpers.ta.ema(closes, 12)',
      category: 'ta',
      returns: 'EMA 值或 null',
    },
    {
      name: 'rsi',
      signature: 'helpers.ta.rsi(prices: number[], period?: number): number | null',
      description: '计算相对强弱指标',
      example: 'const rsi14 = helpers.ta.rsi(closes, 14)',
      category: 'ta',
      returns: 'RSI 值 (0-100) 或 null',
    },
    {
      name: 'macd',
      signature: 'helpers.ta.macd(prices: number[], fast?: number, slow?: number, signal?: number): object | null',
      description: '计算 MACD 指标',
      example: 'const { macd, signal, histogram } = helpers.ta.macd(closes) || {}',
      category: 'ta',
      returns: '{ macd, signal, histogram } 或 null',
    },
    {
      name: 'atr',
      signature: 'helpers.ta.atr(bars: Bar[], period?: number): number | null',
      description: '计算平均真实波幅',
      example: 'const atr14 = helpers.ta.atr(bars, 14)',
      category: 'ta',
      returns: 'ATR 值或 null',
    },
    {
      name: 'bollingerBands',
      signature: 'helpers.ta.bollingerBands(prices: number[], period?: number, stdDev?: number): object | null',
      description: '计算布林带',
      example: 'const { upper, middle, lower } = helpers.ta.bollingerBands(closes, 20, 2) || {}',
      category: 'ta',
      returns: '{ upper, middle, lower } 或 null',
    },
    {
      name: 'smaVolume',
      signature: 'helpers.ta.smaVolume(bars: Bar[], period: number): number | null',
      description: '计算成交量简单移动平均线',
      example: 'const avgVolume20 = helpers.ta.smaVolume(bars, 20)',
      category: 'ta',
      returns: '成交量 SMA 值或 null',
    },
    
    // 信号生成
    {
      name: 'crossOver',
      signature: 'helpers.signal.crossOver(series1: number[], series2: number[]): boolean',
      description: '判断 series1 是否上穿 series2（金叉）',
      example: 'if (helpers.signal.crossOver(fastMA, slowMA)) { /* 买入信号 */ }',
      category: 'signal',
      returns: 'true 或 false',
    },
    {
      name: 'crossUnder',
      signature: 'helpers.signal.crossUnder(series1: number[], series2: number[]): boolean',
      description: '判断 series1 是否下穿 series2（死叉）',
      example: 'if (helpers.signal.crossUnder(fastMA, slowMA)) { /* 卖出信号 */ }',
      category: 'signal',
      returns: 'true 或 false',
    },
    {
      name: 'rollingHigh',
      signature: 'helpers.signal.rollingHigh(bars: Bar[], period: number): number | null',
      description: '读取最近 N 根 K 线最高价',
      example: 'const high20 = helpers.signal.rollingHigh(bars, 20)',
      category: 'signal',
      returns: '最高价或 null',
    },
    {
      name: 'rollingLow',
      signature: 'helpers.signal.rollingLow(bars: Bar[], period: number): number | null',
      description: '读取最近 N 根 K 线最低价',
      example: 'const low20 = helpers.signal.rollingLow(bars, 20)',
      category: 'signal',
      returns: '最低价或 null',
    },
    {
      name: 'isOverbought',
      signature: 'helpers.signal.isOverbought(rsi: number, threshold?: number): boolean',
      description: '判断是否超买（默认阈值 70）',
      example: 'if (helpers.signal.isOverbought(rsi14)) { /* 超买 */ }',
      category: 'signal',
      returns: 'true 或 false',
    },
    {
      name: 'isOversold',
      signature: 'helpers.signal.isOversold(rsi: number, threshold?: number): boolean',
      description: '判断是否超卖（默认阈值 30）',
      example: 'if (helpers.signal.isOversold(rsi14)) { /* 超卖 */ }',
      category: 'signal',
      returns: 'true 或 false',
    },
    {
      name: 'calcStopLoss',
      signature: 'helpers.signal.calcStopLoss(entryPrice: number, atr: number, multiplier?: number, direction?: string): number',
      description: '基于 ATR 计算止损价格',
      example: 'const stopLoss = helpers.signal.calcStopLoss(entryPrice, atr14, 2, "BUY")',
      category: 'signal',
      returns: '止损价格',
    },
    {
      name: 'calcTakeProfit',
      signature: 'helpers.signal.calcTakeProfit(entryPrice: number, stopLoss: number, riskRewardRatio?: number, direction?: string): number',
      description: '基于风险回报比计算止盈价格',
      example: 'const takeProfit = helpers.signal.calcTakeProfit(entryPrice, stopLoss, 2, "BUY")',
      category: 'signal',
      returns: '止盈价格',
    },
    {
      name: 'trendDirection',
      signature: 'helpers.signal.trendDirection(prices: number[], period?: number): string | null',
      description: '判断价格趋势方向',
      example: 'const trend = helpers.signal.trendDirection(closes, 20) // "UP", "DOWN", or "SIDEWAYS"',
      category: 'signal',
      returns: '"UP" | "DOWN" | "SIDEWAYS" | null',
    },
  ]
}
