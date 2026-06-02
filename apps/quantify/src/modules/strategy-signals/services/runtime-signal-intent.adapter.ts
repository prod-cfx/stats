import type { StrategyDecisionV1 } from '@ai/shared'

type RuntimeSignalDirection = 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type RuntimeSignalType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT'
type RuntimeSignalOrderIntent = {
  orderType: 'market' | 'limit'
  limitPrice?: number
  timeInForce?: 'gtc' | 'ioc' | 'fok'
  triggerConditionRef?: string
}

export type RuntimeSignalIntentResult =
  | {
      kind: 'signal'
      signal: {
        direction: RuntimeSignalDirection
        signalType: RuntimeSignalType
        entryPrice: number
        positionSizeQuote?: number
        positionSizeRatio?: number
        reasoning: string
        confidence?: number
        stopLoss?: number
        takeProfit?: number
        order?: RuntimeSignalOrderIntent
      }
    }
  | { kind: 'noop'; reason: string }
  | { kind: 'missing_required_truth'; reasonCode: string; fields: string[] }

export interface RuntimeDecisionContext {
  exchange: string
  marketType: 'spot' | 'perp'
  symbol: string
  timeframe: string
  referencePrice?: number
  currentQty?: number
}

export class RuntimeSignalIntentAdapter {
  fromDecision(decision: StrategyDecisionV1, ctx: RuntimeDecisionContext): RuntimeSignalIntentResult {
    const reason = this.resolveReason(decision.reason)
    if (!reason) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_REASONING_MISSING', ['reason'])
    }

    if (decision.action === 'NOOP') {
      return {
        kind: 'noop',
        reason,
      }
    }

    if (!this.isFinitePositiveNumber(ctx.referencePrice)) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING', ['referencePrice'])
    }

    if (decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') {
      if (!decision.size) {
        return this.missingRequiredTruth('RUNTIME_SIGNAL_SIZE_MISSING', ['size'])
      }

      if (decision.size.mode !== 'QUOTE' && decision.size.mode !== 'RATIO') {
        return this.missingRequiredTruth('RUNTIME_SIGNAL_ENTRY_SIZE_MODE_UNSUPPORTED', ['size.mode'])
      }

      if (!this.isFinitePositiveNumber(decision.size.value)) {
        return this.missingRequiredTruth('RUNTIME_SIGNAL_ENTRY_SIZE_VALUE_INVALID', ['size.value'])
      }

      return {
        kind: 'signal',
        signal: {
          direction: decision.action === 'OPEN_LONG' ? 'BUY' : 'SELL',
          signalType: 'ENTRY',
          entryPrice: ctx.referencePrice,
          reasoning: reason,
          ...(decision.size.mode === 'QUOTE' ? { positionSizeQuote: decision.size.value } : {}),
          ...(decision.size.mode === 'RATIO' ? { positionSizeRatio: decision.size.value } : {}),
          ...this.buildOptionalSignalFields(decision),
          ...this.buildOrderSignalField(decision),
        },
      }
    }

    if (decision.action === 'ADJUST_POSITION') {
      return this.buildAdjustPositionSignal(decision, ctx, reason)
    }

    return {
      kind: 'signal',
      signal: {
        direction: decision.action,
        signalType: 'EXIT',
        entryPrice: ctx.referencePrice,
        reasoning: reason,
        ...this.buildOptionalSignalFields(decision),
        ...this.buildOrderSignalField(decision),
      },
    }
  }

  private buildAdjustPositionSignal(
    decision: StrategyDecisionV1,
    ctx: RuntimeDecisionContext,
    reason: string,
  ): RuntimeSignalIntentResult {
    if (!decision.size) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_SIZE_MISSING', ['size'])
    }

    if (decision.size.mode !== 'QTY') {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_ADJUST_SIZE_MODE_UNSUPPORTED', ['size.mode'])
    }

    if (!this.isFiniteNumber(decision.size.value)) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_ADJUST_SIZE_VALUE_INVALID', ['size.value'])
    }

    const adjustMode = decision.adjustMode ?? 'TARGET'
    const currentQty = ctx.currentQty
    if (adjustMode === 'TARGET' && !this.isFiniteNumber(currentQty)) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_CURRENT_QTY_MISSING', ['currentQty'])
    }

    const deltaQty = adjustMode === 'DELTA'
      ? decision.size.value
      : decision.size.value - (currentQty ?? 0)
    if (deltaQty === 0) {
      return {
        kind: 'noop',
        reason,
      }
    }

    return {
      kind: 'signal',
      signal: {
        direction: deltaQty > 0 ? 'BUY' : 'SELL',
        signalType: 'ADJUSTMENT',
        entryPrice: ctx.referencePrice,
        reasoning: reason,
        positionSizeQuote: Math.abs(deltaQty) * ctx.referencePrice,
        ...this.buildOptionalSignalFields(decision),
        ...this.buildOrderSignalField(decision),
      },
    }
  }

  private missingRequiredTruth(reasonCode: string, fields: string[]): RuntimeSignalIntentResult {
    return {
      kind: 'missing_required_truth',
      reasonCode,
      fields,
    }
  }

  private resolveReason(reason: StrategyDecisionV1['reason']): string | null {
    if (typeof reason !== 'string') {
      return null
    }

    const trimmedReason = reason.trim()
    return trimmedReason ? trimmedReason : null
  }

  private buildOptionalSignalFields(decision: StrategyDecisionV1): {
    confidence?: number
    stopLoss?: number
    takeProfit?: number
  } {
    const optionalFields: {
      confidence?: number
      stopLoss?: number
      takeProfit?: number
    } = {}

    if (this.isFinitePositiveNumber(decision.confidence)) {
      optionalFields.confidence = decision.confidence
    }
    if (this.isFinitePositiveNumber(decision.risk?.stopLoss)) {
      optionalFields.stopLoss = decision.risk.stopLoss
    }
    if (this.isFinitePositiveNumber(decision.risk?.takeProfit)) {
      optionalFields.takeProfit = decision.risk.takeProfit
    }

    return optionalFields
  }

  private buildOrderSignalField(decision: StrategyDecisionV1): { order?: RuntimeSignalOrderIntent } {
    const raw = decision.meta?.order
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const order = raw as Record<string, unknown>
    const orderType = order.orderType === 'limit' ? 'limit' : order.orderType === 'market' ? 'market' : null
    if (!orderType) return {}
    const limitPrice = this.isFinitePositiveNumber(order.limitPrice) ? order.limitPrice : undefined
    const timeInForce = order.timeInForce === 'gtc' || order.timeInForce === 'ioc' || order.timeInForce === 'fok'
      ? order.timeInForce
      : undefined
    const triggerConditionRef = typeof order.triggerConditionRef === 'string' && order.triggerConditionRef.trim()
      ? order.triggerConditionRef.trim()
      : undefined

    return {
      order: {
        orderType,
        ...(limitPrice !== undefined ? { limitPrice } : {}),
        ...(timeInForce ? { timeInForce } : {}),
        ...(triggerConditionRef ? { triggerConditionRef } : {}),
      },
    }
  }

  private isFinitePositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }
}
