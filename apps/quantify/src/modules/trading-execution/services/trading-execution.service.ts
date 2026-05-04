import { Injectable } from '@nestjs/common'
import { TradingService } from '@/modules/trading/trading.service'
import { ClientOrderIdFactoryService } from './client-order-id-factory.service'
import { OrderAdmissionGateService } from './order-admission-gate.service'
import { OrderNormalizerService } from './order-normalizer.service'
import type { OrderIntent, TradingExecutionResult } from '../types/trading-execution.types'

@Injectable()
export class TradingExecutionService {
  constructor(
    private readonly tradingService: TradingService,
    private readonly clientOrderIds: ClientOrderIdFactoryService,
    private readonly normalizer: OrderNormalizerService,
    private readonly admissionGate: OrderAdmissionGateService,
  ) {}

  async executeIntent(intent: OrderIntent): Promise<TradingExecutionResult> {
    let constraints
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
      return { status: 'waiting_constraints', intent, reason: (error as Error).message, error }
    }

    const clientOrderId = this.clientOrderIds.create({
      exchangeId: intent.exchangeId,
      source: intent.source,
      sourceId: intent.sourceId,
      maxLength: constraints.clientOrderId.maxLength,
      pattern: constraints.clientOrderId.pattern,
    })

    let normalized
    try {
      normalized = this.normalizer.normalize(intent, constraints, clientOrderId)
    }
    catch (error) {
      return { status: 'rejected', intent, reason: (error as Error).message }
    }

    const requiresPositions = intent.reduceOnly || intent.role === 'close_long' || intent.role === 'close_short'
    const positions = requiresPositions
      ? await this.tradingService.getPositions(intent.userId, intent.exchangeId, intent.marketType, intent.exchangeAccountId ?? undefined)
      : []
    const admission = this.admissionGate.evaluate(intent, positions)
    if (!admission.ok) {
      return { status: admission.status, intent, reason: admission.reason }
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
      return { status: 'submit_failed', intent, normalized, reason: (error as Error).message, error }
    }
  }
}
