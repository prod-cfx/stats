/**
 * 金额/数量字符串化与精度工具（不依赖大数库）
 * - 统一将金额表示为字符串，默认固定 6 位小数
 */

export const assetPrecisionMap: Record<string, number> = {
  SCORE: 6,
  DIAMOND: 6,
}

export function getAssetPrecision(assetTypeIdOrCode?: string, fallback = 6): number {
  if (!assetTypeIdOrCode) return fallback
  const key = String(assetTypeIdOrCode).toUpperCase()
  return assetPrecisionMap[key] ?? fallback
}

export function normalizeAmountByAsset(
  assetTypeIdOrCode: string | undefined,
  value: unknown,
  fallbackPrecision = 6,
): string {
  const precision = getAssetPrecision(assetTypeIdOrCode, fallbackPrecision)
  return normalizeToFixed(value, precision)
}

/**
 * 将输入归一化为固定小数位的字符串（截断而非四舍五入）。
 * 适用于唯一键/幂等键、审计日志等需要稳定字符串的场景。
 */
export function normalizeToFixed(value: unknown, precision = 6): string {
  const s = String(value)
  if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('invalid amount')
  const [intPart, fracPart = ''] = s.split('.')
  const frac = (fracPart + '0'.repeat(precision)).slice(0, precision)
  return precision > 0 ? `${stripLeadingZeros(intPart)}.${frac}` : stripLeadingZeros(intPart)
}

/**
 * 面向展示的金额格式化，移除多余尾随 0 与小数点。
 */
export function toDisplayAmount(value: unknown, precision = 6): string {
  let s = normalizeToFixed(value, precision)
  if (s.includes('.')) {
    // 去除末尾多余 0
    while (s.endsWith('0')) s = s.slice(0, -1)
    // 若最后是小数点，去掉
    if (s.endsWith('.')) s = s.slice(0, -1)
  }
  return s
}

function stripLeadingZeros(intPart: string): string {
  const s = intPart.replace(/^0+(\d)/, '$1')
  return s === '' ? '0' : s
}
