import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type { NormalizedOrderIntent, OrderIntent, TradingExecutionConstraints } from '../types/trading-execution.types'

@Injectable()
export class OrderNormalizerService {
  normalize(intent: OrderIntent, constraints: TradingExecutionConstraints, clientOrderId: string): NormalizedOrderIntent {
    const normalizedPrice = intent.type === 'limit'
      ? this.normalizePrice(intent.price, constraints)
      : undefined
    const normalizedAmount = this.normalizeAmount(intent.amount, constraints)
    const request = {
      symbol: intent.symbol,
      marketType: intent.marketType,
      side: intent.side,
      type: intent.type,
      amount: Number(normalizedAmount),
      price: normalizedPrice === undefined ? undefined : Number(normalizedPrice),
      timeInForce: intent.timeInForce,
      reduceOnly: intent.reduceOnly,
      tdMode: intent.tdMode,
      clientOrderId,
    }

    return {
      request,
      normalizedPrice,
      normalizedAmount,
      exchangeSize: this.toExchangeSize(normalizedAmount, constraints),
      clientOrderId,
      constraints,
    }
  }

  private normalizePrice(value: number | undefined, constraints: TradingExecutionConstraints): string {
    if (value === undefined) throw new Error('trading_execution_limit_price_required')
    const tick = this.positiveDecimal(constraints.priceTickSize, 'trading_execution_missing_price_tick')
    return this.decimal(value).div(tick).toDecimalPlaces(0).mul(tick).toFixed()
  }

  private normalizeAmount(value: number, constraints: TradingExecutionConstraints): string {
    const step = this.quantityStep(constraints)
    const normalized = this.decimal(value).div(step).floor().mul(step)
    const min = constraints.minQuantity ? this.decimal(constraints.minQuantity) : null
    const exchangeSize = this.decimal(this.toExchangeSize(normalized.toFixed(), constraints))
    if (min && exchangeSize.lt(min)) throw new Error('trading_execution_quantity_below_minimum')
    if (!normalized.isPositive()) throw new Error('trading_execution_quantity_below_minimum')
    return normalized.toFixed()
  }

  private quantityStep(constraints: TradingExecutionConstraints): Prisma.Decimal {
    const step = this.positiveDecimal(constraints.quantityStepSize, 'trading_execution_missing_quantity_step')
    if (constraints.marketType !== 'perp' || !constraints.contractValue) return step
    const contractValue = this.positiveDecimal(constraints.contractValue, 'trading_execution_missing_contract_value')
    return step.mul(contractValue)
  }

  private toExchangeSize(amount: string, constraints: TradingExecutionConstraints): string {
    if (constraints.marketType !== 'perp' || !constraints.contractValue) return amount
    const contractValue = this.positiveDecimal(constraints.contractValue, 'trading_execution_missing_contract_value')
    return this.decimal(amount).div(contractValue).toFixed()
  }

  private positiveDecimal(value: string | null | undefined, errorCode: string): Prisma.Decimal {
    if (!value) throw new Error(errorCode)
    const decimal = this.decimal(value)
    if (!decimal.isPositive()) throw new Error(errorCode)
    return decimal
  }

  private decimal(value: string | number): Prisma.Decimal {
    return new Prisma.Decimal(value)
  }
}
