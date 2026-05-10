/**
 * Phase 5 S3 (#1109): timeframe vocab → milliseconds 单一 source-of-truth
 *
 * critic Round 2 M2-R2 修正：
 *   - 原方案 quantify types 与 packages/shared runtime 双 white-list；存在 drift 风险
 *   - 现方案 packages/shared 持唯一权威 mapping；quantify types 反向 import 派生
 *
 * scope.timeframe substrate（runtime alignment + readiness 校验 + NL gateway）
 * 都通过 parseTimeframeMs() 一致解析；新增 / 移除 vocab 仅需改本文件。
 *
 * 与 backend/quantify Prisma kline schema 的 timeframe 字段保持一致；超出范围的
 * 输入返回 null（caller 负责 fail-closed）。
 */

export const TIMEFRAME_MS: Readonly<Record<string, number>> = Object.freeze({
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
})

/**
 * 解析 timeframe identifier 为毫秒；未知 / 非法输入 / 原型链污染返回 null。
 *
 * @example
 *   parseTimeframeMs('15m') // 900_000
 *   parseTimeframeMs('99h') // null
 *   parseTimeframeMs('__proto__') // null
 */
export function parseTimeframeMs(tf: unknown): number | null {
  if (typeof tf !== 'string') return null
  if (!Object.prototype.hasOwnProperty.call(TIMEFRAME_MS, tf)) return null
  const value = TIMEFRAME_MS[tf]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * 派生只读 vocab 数组，与 TIMEFRAME_MS key set 永远等价；
 * quantify 侧 SEMANTIC_SUPPORTED_TIMEFRAMES 直接派生于此。
 */
export const SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAME_MS)) as readonly (keyof typeof TIMEFRAME_MS)[]
