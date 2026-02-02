/**
 * 安全的数字解析工具函数
 * 用于防止 NaN 传播到业务逻辑和数据库
 */

/**
 * 安全地将未知类型的值解析为浮点数
 *
 * @param value - 待解析的值（可以是 number、string 或其他类型）
 * @param defaultValue - 当解析失败时返回的默认值（默认为 0）
 * @returns 解析后的有效数字，或默认值
 *
 * @example
 * ```typescript
 * safeParseFloat('123.45') // 123.45
 * safeParseFloat('invalid') // 0
 * safeParseFloat('invalid', -1) // -1
 * safeParseFloat(null, 100) // 100
 * safeParseFloat(NaN, 50) // 50
 * safeParseFloat(Infinity, 0) // 0
 * ```
 */
export function safeParseFloat(value: unknown, defaultValue = 0): number {
  // 如果已经是数字类型，检查是否为有限数
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue
  }

  // 如果是字符串，尝试解析
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  // 其他类型（null、undefined、object 等）直接返回默认值
  return defaultValue
}

/**
 * 安全地将未知类型的值解析为整数
 *
 * @param value - 待解析的值（可以是 number、string 或其他类型）
 * @param defaultValue - 当解析失败时返回的默认值（默认为 0）
 * @param radix - 进制（默认为 10）
 * @returns 解析后的有效整数，或默认值
 *
 * @example
 * ```typescript
 * safeParseInt('123') // 123
 * safeParseInt('invalid') // 0
 * safeParseInt('FF', 0, 16) // 255
 * safeParseInt(null, -1) // -1
 * ```
 */
export function safeParseInt(value: unknown, defaultValue = 0, radix = 10): number {
  // 如果已经是数字类型，检查是否为有限数并取整
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : defaultValue
  }

  // 如果是字符串，尝试解析
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, radix)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  // 其他类型直接返回默认值
  return defaultValue
}
