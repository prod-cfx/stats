import type { UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import type { OrderIntent } from '../types/trading-execution.types'

type AdmissionResult =
  | { ok: true }
  | { ok: false, status: 'waiting_position', reason: string }

@Injectable()
export class OrderAdmissionGateService {
  evaluate(intent: OrderIntent, positions: UnifiedPosition[]): AdmissionResult {
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

  private normalizeSymbol(symbol: string): string {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
  }
}
