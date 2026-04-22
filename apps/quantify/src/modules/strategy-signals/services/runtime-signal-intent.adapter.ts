import type { StrategyDecisionV1 } from '@ai/shared'

type RuntimeSignalDirection = 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type RuntimeSignalType = 'ENTRY' | 'EXIT'

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
}

export class RuntimeSignalIntentAdapter {
  fromDecision(decision: StrategyDecisionV1, ctx: RuntimeDecisionContext): RuntimeSignalIntentResult {
    if (decision.action === 'ADJUST_POSITION') {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_ACTION_UNSUPPORTED', ['action'])
    }

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
        },
      }
    }

    return {
      kind: 'signal',
      signal: {
        direction: decision.action,
        signalType: 'EXIT',
        entryPrice: ctx.referencePrice,
        reasoning: reason,
        ...this.buildOptionalSignalFields(decision),
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

  private isFinitePositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
  }
}
