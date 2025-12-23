/**
 * 将 Prisma Decimal 类型转换为字符串
 * @param value - 可能是 Decimal 或其他类型的值
 * @returns 转换后的字符串，如果值为 null/undefined 则返回 null
 */
export function convertDecimalToString(value: any): string | null {
  if (value === null || value === undefined) return null
  // 检查是否为 Decimal 类型（通过检查 toString 方法）
  if (value && typeof value === 'object' && 'toString' in value && value.constructor.name === 'Decimal') {
    return value.toString()
  }
  return String(value)
}

/**
 * 批量转换对象中的多个 Decimal 字段为字符串
 * @param obj - 包含 Decimal 字段的对象
 * @param fields - 需要转换的字段名数组
 * @returns 转换后的部分对象
 */
export function convertDecimalsInObject<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
): Partial<Record<keyof T, string | null>> {
  const result: Partial<Record<keyof T, string | null>> = {}
  for (const field of fields) {
    result[field] = convertDecimalToString(obj[field])
  }
  return result
}
