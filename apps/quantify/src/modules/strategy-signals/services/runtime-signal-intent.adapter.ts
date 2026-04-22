import type { StrategyDecisionV1 } from '@ai/shared'

type RuntimeSignalDirection = 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
type RuntimeSignalType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'

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
    if (decision.action === 'NOOP') {
      return {
        kind: 'noop',
        reason: decision.reason ?? '',
      }
    }

    if (decision.action === 'ADJUST_POSITION') {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_ACTION_UNSUPPORTED', ['action'])
    }

    if (!ctx.referencePrice || ctx.referencePrice <= 0) {
      return this.missingRequiredTruth('RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING', ['referencePrice'])
    }

    if (decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') {
      if (!decision.size) {
        return this.missingRequiredTruth('RUNTIME_SIGNAL_SIZE_MISSING', ['size'])
      }

      return {
        kind: 'signal',
        signal: {
          direction: decision.action === 'OPEN_LONG' ? 'BUY' : 'SELL',
          signalType: 'ENTRY',
          entryPrice: ctx.referencePrice,
          reasoning: decision.reason ?? '',
          ...(decision.size.mode === 'QUOTE' ? { positionSizeQuote: decision.size.value } : {}),
          ...(decision.size.mode === 'RATIO' ? { positionSizeRatio: decision.size.value } : {}),
          ...(decision.confidence !== undefined ? { confidence: decision.confidence } : {}),
          ...(decision.risk?.stopLoss !== undefined ? { stopLoss: decision.risk.stopLoss } : {}),
          ...(decision.risk?.takeProfit !== undefined ? { takeProfit: decision.risk.takeProfit } : {}),
        },
      }
    }

    return {
      kind: 'signal',
      signal: {
        direction: decision.action,
        signalType: 'EXIT',
        entryPrice: ctx.referencePrice,
        reasoning: decision.reason ?? '',
        ...(decision.confidence !== undefined ? { confidence: decision.confidence } : {}),
        ...(decision.risk?.stopLoss !== undefined ? { stopLoss: decision.risk.stopLoss } : {}),
        ...(decision.risk?.takeProfit !== undefined ? { takeProfit: decision.risk.takeProfit } : {}),
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
}
