/**
 * 鑴氭湰璋冭瘯宸ュ叿绫?
 * 鐢ㄤ簬鏍煎紡鍖栧拰杈撳嚭绛栫暐鑴氭湰璋冭瘯淇℃伅
 */
export class ScriptDebugUtil {
  /**
   * 鏍煎紡鍖栧€肩敤浜庢棩蹇楄緭鍑?
   * @param value 瑕佹牸寮忓寲鐨勫€?
   * @param maxLength 鏈€澶ч暱搴︼紝榛樿 200
   * @returns 鏍煎紡鍖栧悗鐨勫瓧绗︿覆
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
   * 鏍煎紡鍖栬剼鏈敤浜庢棩蹇楄緭鍑?
   * @param script 鑴氭湰鍐呭
   * @param maxLength 鏈€澶ч暱搴︼紝榛樿 1000
   * @returns 鏍煎紡鍖栧悗鐨勮剼鏈?
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
   * 鍒涘缓鑴氭湰鎽樿锛堢敤浜庣敓浜х幆澧冿級
   * @param script 鑴氭湰鍐呭
   * @returns 鑴氭湰鎽樿淇℃伅
   */
  static createScriptSummary(script: string): string {
    const lines = script.split('\n').length
    const length = script.length
    const hasReturn = script.includes('return')
    const hasAsync = script.includes('async') || script.includes('await')

    return `{ lines: ${lines}, length: ${length}, hasReturn: ${hasReturn}, hasAsync: ${hasAsync} }`
  }
}
