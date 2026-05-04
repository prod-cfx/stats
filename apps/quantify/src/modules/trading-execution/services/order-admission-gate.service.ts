import type { UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import type { OrderIntent } from '../types/trading-execution.types'

type AdmissionResult =
  | { ok: true }
  | { ok: false, status: 'waiting_position', reason: string }
  | { ok: false, status: 'rejected', reason: string }

@Injectable()
export class OrderAdmissionGateService {
  evaluateIntentShape(intent: OrderIntent): AdmissionResult {
    const market = this.validateRoleMarket(intent)
    if (market) return market
    const direction = this.validateRoleDirection(intent)
    if (direction) return direction
    return { ok: true }
  }

  evaluate(intent: OrderIntent, positions: UnifiedPosition[]): AdmissionResult {
    const shape = this.evaluateIntentShape(intent)
    if (!shape.ok) return shape

    const requiredSide = this.requiredPositionSide(intent)
    if (!requiredSide) return { ok: true }

    const hasPosition = positions.some(position =>
      position.side === requiredSide
      && position.size > 0
      && this.normalizeSymbol(position.symbol) === this.normalizeSymbol(intent.symbol)
      && position.marketType === intent.marketType,
    )

    if (hasPosition) return { ok: true }
    return {
      ok: false,
      status: 'waiting_position',
      reason: requiredSide === 'long' ? 'missing_closable_long_position' : 'missing_closable_short_position',
    }
  }

  private requiredPositionSide(intent: OrderIntent): 'long' | 'short' | null {
    if (intent.role === 'close_long') return 'long'
    if (intent.role === 'close_short') return 'short'
    if (!intent.reduceOnly) return null
    return intent.side === 'sell' ? 'long' : 'short'
  }

  private validateRoleDirection(intent: OrderIntent): AdmissionResult | null {
    if (intent.role === 'spot_buy' && intent.side !== 'buy') {
      return { ok: false, status: 'rejected', reason: 'spot_buy_requires_buy_side' }
    }
    if (intent.role === 'spot_sell' && intent.side !== 'sell') {
      return { ok: false, status: 'rejected', reason: 'spot_sell_requires_sell_side' }
    }
    if (intent.role === 'open_long' && intent.side !== 'buy') {
      return { ok: false, status: 'rejected', reason: 'open_long_requires_buy_side' }
    }
    if (intent.role === 'open_short' && intent.side !== 'sell') {
      return { ok: false, status: 'rejected', reason: 'open_short_requires_sell_side' }
    }
    if (intent.role === 'close_long' && intent.side !== 'sell') {
      return { ok: false, status: 'rejected', reason: 'close_long_requires_sell_side' }
    }
    if (intent.role === 'close_short' && intent.side !== 'buy') {
      return { ok: false, status: 'rejected', reason: 'close_short_requires_buy_side' }
    }
    return null
  }

  private validateRoleMarket(intent: OrderIntent): AdmissionResult | null {
    if ((intent.role === 'spot_buy' || intent.role === 'spot_sell') && intent.marketType !== 'spot') {
      return { ok: false, status: 'rejected', reason: 'spot_role_requires_spot_market' }
    }
    if (
      (
        intent.role === 'open_long'
        || intent.role === 'open_short'
        || intent.role === 'close_long'
        || intent.role === 'close_short'
      )
      && intent.marketType !== 'perp'
    ) {
      return { ok: false, status: 'rejected', reason: 'perp_role_requires_perp_market' }
    }
    return null
  }

  private normalizeSymbol(symbol: string): string {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
  }
}
