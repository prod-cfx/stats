import type {
  StrategyAction,
  StrategyAdapterV1,
  StrategyDecisionSize,
  StrategyDecisionV1,
  StrategySizeMode,
} from '@ai/shared'

export interface StrategyDecisionValidationResult {
  valid: boolean
  error?: string
  value?: StrategyDecisionV1
}

export interface ResolveStrategyOutputResult {
  decision?: StrategyDecisionV1
  passthrough?: Record<string, unknown>
  error?: string
}

const ALLOWED_ACTIONS: readonly StrategyAction[] = [
  'OPEN_LONG',
  'OPEN_SHORT',
  'CLOSE_LONG',
  'CLOSE_SHORT',
  'ADJUST_POSITION',
  'NOOP',
]

const ALLOWED_SIZE_MODES: readonly StrategySizeMode[] = ['QUOTE', 'RATIO', 'QTY']

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isStrategyAdapterV1(value: unknown): value is StrategyAdapterV1 {
  if (!isPlainRecord(value)) return false
  return value.protocolVersion === 'v1' && typeof value.onBar === 'function'
}

export function validateStrategyDecision(value: unknown): StrategyDecisionValidationResult {
  if (!isPlainRecord(value)) {
    return { valid: false, error: '策略决策必须是对象' }
  }

  const action = value.action
  if (typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action as StrategyAction)) {
    return { valid: false, error: '策略决策缺少合法 action' }
  }

  const sizeRaw = value.size
  if (action !== 'NOOP') {
    if (!isPlainRecord(sizeRaw)) {
      return { valid: false, error: '非 NOOP 决策必须提供 size' }
    }

    const mode = sizeRaw.mode
    const sizeValue = sizeRaw.value
    if (typeof mode !== 'string' || !ALLOWED_SIZE_MODES.includes(mode as StrategySizeMode)) {
      return { valid: false, error: 'size.mode 必须是 QUOTE/RATIO/QTY' }
    }
    if (typeof sizeValue !== 'number' || !Number.isFinite(sizeValue)) {
      return { valid: false, error: 'size.value 必须是有限数字' }
    }

    if (mode === 'QUOTE' && sizeValue <= 0) {
      return { valid: false, error: 'QUOTE 模式要求 size.value > 0' }
    }
    if (mode === 'RATIO' && (sizeValue <= 0 || sizeValue > 1)) {
      return { valid: false, error: 'RATIO 模式要求 size.value 在 (0,1] 范围内' }
    }
    if (mode === 'QTY' && sizeValue === 0) {
      return { valid: false, error: 'QTY 模式要求 size.value 不能为 0' }
    }
  }

  if (action === 'ADJUST_POSITION') {
    const adjustMode = value.adjustMode
    if (adjustMode !== undefined && adjustMode !== 'TARGET' && adjustMode !== 'DELTA') {
      return { valid: false, error: 'ADJUST_POSITION 的 adjustMode 只能是 TARGET 或 DELTA' }
    }
    if (!isPlainRecord(sizeRaw) || sizeRaw.mode !== 'QTY') {
      return { valid: false, error: 'ADJUST_POSITION 仅支持 size.mode=QTY' }
    }
  }

  if (value.confidence !== undefined) {
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100) {
      return { valid: false, error: 'confidence 必须在 0~100 范围内' }
    }
  }

  if (value.reason !== undefined) {
    if (typeof value.reason !== 'string' || !value.reason.trim()) {
      return { valid: false, error: 'reason 必须是非空字符串' }
    }
  }

  if (value.risk !== undefined) {
    if (!isPlainRecord(value.risk)) {
      return { valid: false, error: 'risk 必须是对象' }
    }
    for (const key of ['stopLoss', 'takeProfit', 'maxDrawdown'] as const) {
      const candidate = value.risk[key]
      if (candidate !== undefined && (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0)) {
        return { valid: false, error: `risk.${key} 必须是 > 0 的数字` }
      }
    }
  }

  return {
    valid: true,
    value: {
      action: action as StrategyAction,
      size: sizeRaw as StrategyDecisionSize | undefined,
      adjustMode: value.adjustMode as StrategyDecisionV1['adjustMode'],
      confidence: value.confidence as number | undefined,
      reason: value.reason as string | undefined,
      risk: value.risk as StrategyDecisionV1['risk'],
      meta: isPlainRecord(value.meta) ? value.meta : undefined,
    },
  }
}

export async function resolveStrategyOutput(
  value: Record<string, unknown>,
  ctx: Record<string, unknown>,
): Promise<ResolveStrategyOutputResult> {
  if (isStrategyAdapterV1(value)) {
    let decisionRaw: unknown
    try {
      decisionRaw = await value.onBar(ctx)
    } catch (error) {
      return {
        error: `策略适配器 onBar 执行失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    const decisionValidation = validateStrategyDecision(decisionRaw)
    if (!decisionValidation.valid || !decisionValidation.value) {
      return {
        error: decisionValidation.error ?? '策略适配器返回了非法决策',
      }
    }

    return {
      decision: decisionValidation.value,
    }
  }

  const decisionValidation = validateStrategyDecision(value)
  if (decisionValidation.valid && decisionValidation.value) {
    return {
      decision: decisionValidation.value,
    }
  }

  return {
    passthrough: value,
  }
}

export function strategyDecisionToSignalPayload(
  decision: StrategyDecisionV1,
  referencePrice: number,
): Record<string, unknown> {
  const safePrice = referencePrice > 0 ? referencePrice : 1

  const direction = (() => {
    switch (decision.action) {
      case 'OPEN_LONG': return 'BUY'
      case 'OPEN_SHORT': return 'SELL'
      case 'CLOSE_LONG': return 'CLOSE_LONG'
      case 'CLOSE_SHORT': return 'CLOSE_SHORT'
      case 'ADJUST_POSITION': return 'BUY'
      case 'NOOP':
      default: return 'BUY'
    }
  })()

  const signalType = decision.action === 'NOOP' ? 'ALERT' : 'ENTRY'
  const payload: Record<string, unknown> = {
    direction,
    signalType,
    confidence: decision.confidence ?? 80,
    entryPrice: safePrice,
    stopLoss: decision.risk?.stopLoss ?? Math.max(0.00000001, safePrice * 0.98),
    takeProfit: decision.risk?.takeProfit ?? safePrice * 1.02,
    reasoning: decision.reason ?? 'Strategy adapter decision',
  }

  if (decision.size) {
    if (decision.size.mode === 'QUOTE') payload.positionSizeQuote = Math.abs(decision.size.value)
    if (decision.size.mode === 'RATIO') payload.positionSizeRatio = Math.abs(decision.size.value)
    if (decision.size.mode === 'QTY') payload.positionSizeQuote = Math.abs(decision.size.value) * safePrice
  }

  return payload
}

export function strategyDecisionToDeltaQty(
  decision: StrategyDecisionV1,
  context: { currentQty: number; equity: number; markPrice: number },
): number {
  const price = context.markPrice > 0 ? context.markPrice : 1
  const qtyFromSize = (() => {
    if (!decision.size) return 0
    if (decision.size.mode === 'QTY') return decision.size.value
    if (decision.size.mode === 'QUOTE') return decision.size.value / price
    return (Math.max(0, context.equity) * decision.size.value) / price
  })()

  switch (decision.action) {
    case 'OPEN_LONG':
      return Math.abs(qtyFromSize)
    case 'OPEN_SHORT':
      return -Math.abs(qtyFromSize)
    case 'CLOSE_LONG':
      return context.currentQty > 0 ? -context.currentQty : 0
    case 'CLOSE_SHORT':
      return context.currentQty < 0 ? Math.abs(context.currentQty) : 0
    case 'ADJUST_POSITION': {
      const adjustMode = decision.adjustMode ?? 'TARGET'
      if (adjustMode === 'DELTA') {
        return qtyFromSize
      }
      return qtyFromSize - context.currentQty
    }
    case 'NOOP':
    default:
      return 0
  }
}
