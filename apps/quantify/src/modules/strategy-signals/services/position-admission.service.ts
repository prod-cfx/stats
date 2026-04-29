import type { PositionSide } from '@ai/shared'
import { Injectable } from '@nestjs/common'

export type PortfolioPositionMode = 'long_only' | 'short_only' | 'long_short'

export interface PortfolioAdmissionConstraints {
  positionMode?: PortfolioPositionMode | null
  maxConcurrentPositions?: number | null
  allowPyramiding?: boolean | null
}

export interface AdmissionPosition {
  positionSide: PositionSide
  quantity: { toString(): string } | string | number
}

export type PositionAdmissionDecision =
  | { ok: true }
  | { ok: false; reason: string }

@Injectable()
export class PositionAdmissionService {
  evaluateEntry(input: {
    direction: string
    constraints?: PortfolioAdmissionConstraints | null
    openPositions: AdmissionPosition[]
    hasPendingReconciliation?: boolean
  }): PositionAdmissionDecision {
    const entrySide = this.resolveEntrySide(input.direction)
    if (!entrySide) {
      return { ok: true }
    }

    if (input.hasPendingReconciliation) {
      return { ok: false, reason: 'ENTRY_BLOCKED_BY_RECONCILE_REQUIRED' }
    }

    const constraints = input.constraints ?? {}
    const positionMode = constraints.positionMode ?? 'long_short'
    if (positionMode === 'long_only' && entrySide === 'SHORT') {
      return { ok: false, reason: 'ENTRY_BLOCKED_BY_POSITION_MODE' }
    }
    if (positionMode === 'short_only' && entrySide === 'LONG') {
      return { ok: false, reason: 'ENTRY_BLOCKED_BY_POSITION_MODE' }
    }

    const activePositions = input.openPositions.filter(position => Number(position.quantity.toString()) > 0)
    const maxConcurrentPositions = constraints.maxConcurrentPositions ?? 1
    if (maxConcurrentPositions > 0 && activePositions.length >= maxConcurrentPositions) {
      return { ok: false, reason: 'ENTRY_BLOCKED_BY_MAX_CONCURRENT_POSITIONS' }
    }

    if (constraints.allowPyramiding === false) {
      const hasSameSide = activePositions.some(position => position.positionSide === entrySide)
      if (hasSameSide) {
        return { ok: false, reason: 'ENTRY_BLOCKED_BY_PYRAMIDING_DISABLED' }
      }
    }

    return { ok: true }
  }

  private resolveEntrySide(direction: string): PositionSide | null {
    if (direction === 'BUY') return 'LONG' as PositionSide
    if (direction === 'SELL') return 'SHORT' as PositionSide
    return null
  }
}
