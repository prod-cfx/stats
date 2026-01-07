/**
 * JSON Metadata 解析工具函数
 * 用于前端表单中 metadata 字段的解析和验证
 */

/**
 * 解析 metadata 字段
 * @param value - 来自表单的值（可能是字符串或对象）
 * @returns 解析后的对象、null 或 undefined
 * @throws Error 如果 JSON 格式错误
 */
export function parseMetadataField(
  value: unknown
): Record<string, any> | null | undefined {
  if (value === undefined) {
    return undefined
  }

  // 如果已经是对象，直接返回
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, any>
  }

  // 处理字符串
  const metadataStr = String(value || '').trim()

  if (metadataStr === '') {
    return undefined // 空字符串转为 undefined
  }

  try {
    const parsed = JSON.parse(metadataStr)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed
    }
    throw new Error('解析结果不是有效的 JSON 对象')
  } catch {
    throw new Error('扩展配置 JSON 格式错误，请检查')
  }
}

/**
 * 将 metadata 对象格式化为 JSON 字符串（用于表单显示）
 * @param metadata - metadata 对象
 * @param pretty - 是否美化输出
 * @returns JSON 字符串或空字符串
 */
export function stringifyMetadata(
  metadata: Record<string, any> | null | undefined,
  pretty = true
): string {
  if (metadata === null || metadata === undefined) {
    return ''
  }

  try {
    return pretty ? JSON.stringify(metadata, null, 2) : JSON.stringify(metadata)
  } catch {
    return ''
  }
}

/**
 * 比较两个 metadata 对象是否相等（忽略 JSON 格式差异）
 * @param a - 第一个 metadata
 * @param b - 第二个 metadata
 * @returns 是否相等
 */
export function compareMetadata(
  a: Record<string, any> | null | undefined,
  b: Record<string, any> | null | undefined
): boolean {
  // 都是空值，视为相等
  if ((a === null || a === undefined) && (b === null || b === undefined)) {
    return true
  }

  // 一个为空一个不为空
  if ((a === null || a === undefined) !== (b === null || b === undefined)) {
    return false
  }

  try {
    // 标准化 JSON 字符串进行比较
    const strA = JSON.stringify(a)
    const strB = JSON.stringify(b)
    return strA === strB
  } catch {
    return false
  }
}


