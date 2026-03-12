/**
 * 灏?Prisma Decimal 绫诲瀷杞崲涓哄瓧绗︿覆
 * @param value - 鍙兘鏄?Decimal 鎴栧叾浠栫被鍨嬬殑鍊?
 * @returns 杞崲鍚庣殑瀛楃涓诧紝濡傛灉鍊间负 null/undefined 鍒欒繑鍥?null
 */
export function convertDecimalToString(value: any): string | null {
  if (value === null || value === undefined) return null
  // 妫€鏌ユ槸鍚︿负 Decimal 绫诲瀷锛堥€氳繃妫€鏌?toString 鏂规硶锛?
  if (value && typeof value === 'object' && 'toString' in value && value.constructor.name === 'Decimal') {
    return value.toString()
  }
  return String(value)
}

/**
 * 鎵归噺杞崲瀵硅薄涓殑澶氫釜 Decimal 瀛楁涓哄瓧绗︿覆
 * @param obj - 鍖呭惈 Decimal 瀛楁鐨勫璞?
 * @param fields - 闇€瑕佽浆鎹㈢殑瀛楁鍚嶆暟缁?
 * @returns 杞崲鍚庣殑閮ㄥ垎瀵硅薄
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
