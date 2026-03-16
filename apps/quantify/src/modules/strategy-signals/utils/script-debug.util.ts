/**
 * 脚本调试工具
 * 用于格式化和输出策略脚本调试信息
 */
export class ScriptDebugUtil {
  /**
   * 格式化值用于日志输出
   * @param value 要格式化的值
   * @param maxLength 最大长度，默认 200
   * @returns 格式化后的字符串
   */
  static formatValueForLog(value: unknown, maxLength = 200): string {
    try {
      if (value === null) {
        return 'null'
      }

      if (value === undefined) {
        return 'undefined'
      }

      if (typeof value === 'string') {
        return value.length > maxLength
          ? `"${value.substring(0, maxLength)}..."`
          : `"${value}"`
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
      }

      const json = JSON.stringify(value, null, 2)
      return json.length > maxLength
        ? `${json.substring(0, maxLength)}...`
        : json
    } catch {
      return String(value)
    }
  }

  /**
   * 格式化脚本用于日志输出
   * @param script 脚本内容
   * @param maxLength 最大长度，默认 1000
   * @returns 格式化后的脚本
   */
  static formatScriptForLog(script: string, maxLength = 1000): string {
    if (!script) {
      return '[empty script]'
    }

    if (script.length <= maxLength) {
      return script
    }

    return `${script.substring(0, maxLength)}\n... (truncated, total length: ${script.length} chars)`
  }

  /**
   * 创建脚本摘要（用于生产环境）
   * @param script 脚本内容
   * @returns 脚本摘要信息
   */
  static createScriptSummary(script: string): string {
    const lines = script.split('\n').length
    const length = script.length
    const hasReturn = script.includes('return')
    const hasAsync = script.includes('async') || script.includes('await')

    return `{ lines: ${lines}, length: ${length}, hasReturn: ${hasReturn}, hasAsync: ${hasAsync} }`
  }
}
