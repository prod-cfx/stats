/**
 * 解析布尔型 query 参数。
 *
 * Swagger 声明 `type: 'boolean'` 的 query 参数在传输层是字符串。
 * 这个 helper 把以下值视为 true：
 *   - 'true' / 'TRUE' / 'True'（任意大小写）
 *   - '1'
 *   - true（boolean，按 NestJS pipe 自动转换的可能性预留）
 *
 * 其它任何值（包括 undefined / null / 空字符串 / 'false' / '0'）一律视为 false。
 *
 * 不在此抛错；调用方若需要拒绝未知值应在 DTO 校验层处理。
 */
export function parseBooleanQuery(raw: unknown): boolean {
  if (raw === true) return true
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}
