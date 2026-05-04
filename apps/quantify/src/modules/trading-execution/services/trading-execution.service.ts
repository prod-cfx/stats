import type { UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import { TradingService } from '@/modules/trading/trading.service'
import { ClientOrderIdFactoryService } from './client-order-id-factory.service'
import { OrderAdmissionGateService } from './order-admission-gate.service'
import { OrderNormalizerService } from './order-normalizer.service'
import type {
  NormalizedOrderIntent,
  OrderIntent,
  PreparedOrderIntent,
  TradingExecutionConstraints,
  TradingExecutionPrepareResult,
  TradingExecutionResult,
  TradingExecutionSubmitPreparedResult,
} from '../types/trading-execution.types'

@Injectable()
export class TradingExecutionService {
  constructor(
    private readonly tradingService: TradingService,
    private readonly clientOrderIds: ClientOrderIdFactoryService,
    private readonly normalizer: OrderNormalizerService,
    private readonly admissionGate: OrderAdmissionGateService,
  ) {}

  async executeIntent(intent: OrderIntent): Promise<TradingExecutionResult> {
    const prepared = await this.prepareIntent(intent)
    if (prepared.status !== 'prepared') return prepared
    const submitted = await this.submitPrepared(prepared)
    return submitted
  }

  async prepareIntent(intent: OrderIntent): Promise<TradingExecutionPrepareResult> {
    const shape = this.admissionGate.evaluateIntentShape(intent)
    if (shape.ok === false) {
      return { status: 'rejected', intent, reason: shape.reason }
    }

    let constraints: TradingExecutionConstraints
    try {
      constraints = await this.tradingService.getInstrumentConstraints(
        intent.userId,
        intent.exchangeId,
        intent.marketType,
        intent.symbol,
        intent.exchangeAccountId ?? undefined,
      )
    }
    catch (error) {
      return { status: 'waiting_constraints', intent, reason: this.errorReason(error), error }
    }

    let clientOrderId: string
    try {
      clientOrderId = this.clientOrderIds.create({
        exchangeId: intent.exchangeId,
        source: intent.source,
        sourceId: intent.sourceId,
        maxLength: constraints.clientOrderId.maxLength,
        pattern: constraints.clientOrderId.pattern,
      })
    }
    catch (error) {
      return { status: 'rejected', intent, reason: this.errorReason(error) }
    }

    let normalized: NormalizedOrderIntent
    try {
      normalized = this.normalizer.normalize(intent, constraints, clientOrderId)
    }
    catch (error) {
      return { status: 'rejected', intent, reason: this.errorReason(error) }
    }

    return {
      status: 'prepared',
      intent,
      constraints,
      normalized,
    }
  }

  async submitPrepared(prepared: PreparedOrderIntent): Promise<TradingExecutionSubmitPreparedResult> {
    const { intent, normalized } = prepared
    const requiresPositions = intent.reduceOnly || intent.role === 'close_long' || intent.role === 'close_short'
    let positions: UnifiedPosition[] = []
    if (requiresPositions) {
      try {
        positions = await this.tradingService.getPositions(intent.userId, intent.exchangeId, intent.marketType, intent.exchangeAccountId ?? undefined)
      }
      catch (error) {
        return { status: 'waiting_position', intent, normalized, reason: 'positions_unavailable', error }
      }
    }
    const admission = this.admissionGate.evaluate(intent, positions)
    if (admission.ok === false) {
      return { status: admission.status, intent, normalized, reason: admission.reason }
    }

    try {
      const order = await this.tradingService.placeOrder(
        intent.userId,
        intent.exchangeId,
        intent.marketType,
        normalized.request,
        intent.exchangeAccountId ?? undefined,
      )
      return { status: 'submitted', intent, normalized, order }
    }
    catch (error) {
      return { status: 'submit_failed', intent, normalized, reason: this.errorReason(error), error }
    }
  }

  private errorReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
