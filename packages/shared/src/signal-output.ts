export type AiSignalDirection = 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'

export type AiSignalType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'

export interface AiSignalPayload {
  direction: AiSignalDirection
  signalType: AiSignalType
  confidence?: number
  entryPrice?: number
  stopLoss?: number
  takeProfit?: number
  reasoning?: string
  positionSizeQuote?: number
  positionSizeRatio?: number
}

const SUPPORTED_DIRECTIONS: Record<string, AiSignalDirection> = {
  BUY: 'BUY',
  LONG: 'BUY',
  SELL: 'SELL',
  SHORT: 'SELL',
  CLOSE_LONG: 'CLOSE_LONG',
  CLOSE_SHORT: 'CLOSE_SHORT',
}

const SUPPORTED_SIGNAL_TYPES: Record<string, AiSignalType> = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  ADJUSTMENT: 'ADJUSTMENT',
  ALERT: 'ALERT',
}

/**
 * 从 LLM 的完整文本响应中提取并解析信号 JSON。
 * - 自动裁剪前后解释性文字，只解析第一个 `{` 到最后一个 `}` 之间的内容
 * - 支持多个字段别名（action/type/score 等）
 * - 对 confidence/positionSizeRatio 做安全范围裁剪
 */
export function parseAiSignalResponse(
  content: string,
  fallbackPrice?: number,
): AiSignalPayload | null {
  if (!content) return null

  const jsonFragment = extractJsonFragment(content)
  if (!jsonFragment) {
    return null
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonFragment)
  } catch {
    return null
  }

  const directionRaw = normalizeString(parsed.direction ?? parsed.action)
  const direction = directionRaw ? SUPPORTED_DIRECTIONS[directionRaw] : undefined
  if (!direction) {
    return null
  }

  const signalTypeRaw = normalizeString(parsed.signalType ?? parsed.type)
  const signalType = signalTypeRaw ? SUPPORTED_SIGNAL_TYPES[signalTypeRaw] : 'ENTRY'

  const confidenceRaw =
    parsed.confidence ?? parsed.confidenceScore ?? parsed.score
  const confidenceVal = parseNumber(confidenceRaw)
  const confidence =
    confidenceVal !== null ? clamp(confidenceVal, 0, 100) : undefined

  const entryPrice =
    parseNumber(parsed.entryPrice ?? parsed.price) ?? fallbackPrice
  const stopLoss = parseNumber(parsed.stopLoss)
  const takeProfit = parseNumber(parsed.takeProfit)

  const reasoning =
    typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined

  // 仓位：支持多种字段别名
  const positionSizeQuote =
    parseNumber(
      parsed.positionSizeQuote ?? parsed.positionSize ?? parsed.quoteAmount,
    ) ?? undefined

  const ratioRaw =
    parsed.positionSizeRatio ?? parsed.positionRatio ?? parsed.sizeRatio
  const ratioVal = parseNumber(ratioRaw)
  const positionSizeRatio =
    ratioVal !== null && ratioVal >= 0 && ratioVal <= 1 ? ratioVal : undefined

  return {
    direction,
    signalType,
    confidence,
    entryPrice: entryPrice ?? undefined,
    stopLoss: stopLoss ?? undefined,
    takeProfit: takeProfit ?? undefined,
    reasoning,
    positionSizeQuote,
    positionSizeRatio,
  }
}

/**
 * 从一段文本中提取第一个完整的 JSON 对象片段。
 * 只考虑最外层 `{ ... }`，忽略前后解释性文字。
 */
export function extractJsonFragment(content: string): string | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  return content.slice(start, end + 1)
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * 填充 Prompt 模板中的占位符：
 * - 支持 {{variable}} 与 ${variable} 两种形式
 * - 未找到的变量保持原样
 */
export function fillPromptTemplate(
  template: string | undefined | null,
  data: Record<string, unknown>,
): string | undefined {
  if (!template) return undefined

  // 确保 data 是一个对象，防止 'in' 操作符报错
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return template
  }

  // 单次遍历同时处理 {{var}} 与 ${var} 两种占位符形式
  // 使用 'in' 操作符以支持原型链和 getter（向后兼容）
  return template.replace(
    /\{\{(\w+)\}\}|\$\{(\w+)\}/g,
    (match, key1, key2) => {
      const key = key1 || key2
      return key in data
        ? String((data as Record<string, unknown>)[key])
        : match
    },
  )
}

