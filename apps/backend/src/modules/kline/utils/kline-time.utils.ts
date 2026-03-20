/**
 * K线时间粒度到毫秒的映射
 */
export const INTERVAL_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
}

/**
 * 计算给定时间戳对应的 K线周期开始时间
 *
 * @param timestamp 原始时间戳 (毫秒)
 * @param interval 时间粒度 (1m, 5m, 15m, 1h, 4h, 1d)
 * @returns K线周期开始时间 (毫秒,已对齐到周期边界)
 *
 * @example
 * // 假设当前时间是 2025-01-23 10:37:45
 * getKlineStartTime(1737619065000, '1m')  // 返回 2025-01-23 10:37:00
 * getKlineStartTime(1737619065000, '5m')  // 返回 2025-01-23 10:35:00
 * getKlineStartTime(1737619065000, '15m') // 返回 2025-01-23 10:30:00
 * getKlineStartTime(1737619065000, '1h')  // 返回 2025-01-23 10:00:00
 */
export function getKlineStartTime(timestamp: number, interval: string): number {
  const intervalMs = INTERVAL_MS[interval]
  if (!intervalMs) {
    throw new Error(`Unsupported interval: ${interval}`)
  }

  return Math.floor(timestamp / intervalMs) * intervalMs
}

/**
 * 判断两个时间戳是否属于同一个 K线周期
 *
 * @param timestamp1 第一个时间戳 (毫秒)
 * @param timestamp2 第二个时间戳 (毫秒)
 * @param interval 时间粒度
 * @returns 是否属于同一周期
 */
export function isSameKlinePeriod(timestamp1: number, timestamp2: number, interval: string): boolean {
  return getKlineStartTime(timestamp1, interval) === getKlineStartTime(timestamp2, interval)
}

/**
 * 获取下一个 K线周期的开始时间
 *
 * @param currentStartTime 当前周期开始时间 (毫秒)
 * @param interval 时间粒度
 * @returns 下一个周期开始时间 (毫秒)
 */
export function getNextKlineStartTime(currentStartTime: number, interval: string): number {
  const intervalMs = INTERVAL_MS[interval]
  if (!intervalMs) {
    throw new Error(`Unsupported interval: ${interval}`)
  }

  return currentStartTime + intervalMs
}
