import type { MarketTimeframe } from '@ai/shared'

/**
 * 将 MarketTimeframe 转换为分钟数
 */
export function timeframeToMinutes(timeframe: MarketTimeframe): number {
  const map: Record<MarketTimeframe, number> = {
    '1m': 1,
    '3m': 3,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '6h': 360,
    '8h': 480,
    '12h': 720,
    '1d': 1440,
    '1w': 10080,
  }
  return map[timeframe] ?? 60 // 默认 1 小时
}

export const STRATEGY_LEG_ROLES = ['primary', 'hedge', 'context'] as const

export type StrategyLegRole = (typeof STRATEGY_LEG_ROLES)[number]

/**
 * 策略腿定义 - 定义策略的交易对象
 *
 * 一个策略可以包含多个 legs，每个 leg 代表一个交易对象。
 *
 * @example
 * ```typescript
 * {
 *   id: "btc",                    // 在策略中唯一标识这个 leg
 *   symbol: "BTCUSDT",            // 交易对代码
 *   role: "primary",              // 主要交易对象
 *   description: "比特币主合约"   // 可选描述
 * }
 * ```
 */
export interface StrategyLegDefinition {
  /**
   * 在同一策略模板内唯一的 leg 标识，例如：btc、eth、dxy
   */
  id: string
  /**
   * 交易对代码，例如：BTCUSDT、ETHUSDT
   * 只允许大写字母和数字
   */
  symbol: string
  /**
   * leg 的角色，决定其在策略中的用途（主腿 / 对冲 / 上下文）
   */
  role: StrategyLegRole
  /**
   * 可选描述，帮助管理员理解该 leg
   */
  description?: string
}

/**
 * 策略执行配置
 *
 * 定义策略的运行参数，如信号触发频率和冷却时间。
 *
 * @example
 * ```typescript
 * {
 *   timeframe: "1h",           // 每小时检查一次策略条件
 *   cooldownMinutes: 15        // 同一交易对 15 分钟内不重复生成信号
 * }
 * ```
 */
export interface StrategyExecutionConfig {
  /**
   * 信号触发周期，决定多久检查一次策略条件
   *
   * 支持的值：'1m', '5m', '15m', '1h', '4h', '1d'
   */
  timeframe: MarketTimeframe
  /**
   * 冷却时间（分钟），同一交易对在此时间内不会重复生成信号
   *
   * @default 取决于全局配置
   * @min 1
   * @max 1440 (24小时)
   */
  cooldownMinutes?: number
}

/**
 * 策略数据需求 - 定义每个 leg 需要加载的时间周期数据
 *
 * 使用 Record 类型将 leg id 映射到其所需的时间周期数组。
 * 这允许策略为不同的 leg 请求不同的数据周期。
 *
 * @example
 * ```typescript
 * {
 *   "btc": ["15m", "1h", "4h", "1d"],  // BTC leg 需要 4 个周期的数据
 *   "eth": ["1h"],                     // ETH leg 只需要 1h 数据
 *   "dxy": ["1d"]                      // DXY leg 只需要日线数据
 * }
 * ```
 *
 * @remarks
 * - 所有 leg id 必须在 `legs` 数组中存在
 * - 每个 leg 必须至少定义一个 timeframe
 * - 总的 timeframe 数量不应超过系统限制（默认 20）
 */
export type StrategyDataRequirements = Record<string, MarketTimeframe[]>

export const STRATEGY_STATUS_VALUES = ['draft', 'testing', 'live', 'disabled'] as const

export type StrategyStatus = (typeof STRATEGY_STATUS_VALUES)[number]

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[]
