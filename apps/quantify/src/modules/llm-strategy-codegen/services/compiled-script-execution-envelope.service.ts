import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CompiledScriptExecutionEnvelopeService {
  build(
    spec: CanonicalStrategySpecV2,
    semanticPositionMode?: CompiledScriptExecutionEnvelope['positionMode'],
  ): CompiledScriptExecutionEnvelope {
    if (spec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }

    const hasLongExposure = spec.rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_LONG'
      || action.type === 'REDUCE_LONG'
    )))
    const hasShortExposure = spec.rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
      || action.type === 'REDUCE_SHORT'
    )))
    const orderProgramPositionMode = this.resolveOrderProgramPositionMode(spec.orderPrograms ?? [])

    return {
      positionMode: semanticPositionMode ?? this.mergePositionMode({
        orderProgramPositionMode,
        hasLongExposure,
        hasShortExposure,
      }),
      marginMode: spec.market.marketType === 'perp' ? 'cross' : 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    }
  }

  private mergePositionMode(input: {
    orderProgramPositionMode: CompiledScriptExecutionEnvelope['positionMode'] | null
    hasLongExposure: boolean
    hasShortExposure: boolean
  }): CompiledScriptExecutionEnvelope['positionMode'] {
    if (input.orderProgramPositionMode === 'long_short') return 'long_short'
    if (input.orderProgramPositionMode === 'long_only' && input.hasShortExposure) return 'long_short'
    if (input.orderProgramPositionMode === 'short_only' && input.hasLongExposure) return 'long_short'
    if (input.hasLongExposure && input.hasShortExposure) return 'long_short'
    if (input.orderProgramPositionMode) return input.orderProgramPositionMode
    if (input.hasShortExposure) return 'short_only'
    return 'long_only'
  }

  private resolveOrderProgramPositionMode(
    orderPrograms: readonly NonNullable<CanonicalStrategySpecV2['orderPrograms']>[number][],
  ): CompiledScriptExecutionEnvelope['positionMode'] | null {
    let hasLongExposure = false
    let hasShortExposure = false

    orderPrograms.forEach((program) => {
      if (program.mode === 'perp_neutral') {
        hasLongExposure = true
        hasShortExposure = true
        return
      }
      if (program.mode === 'perp_short') {
        hasShortExposure = true
        return
      }
      hasLongExposure = true
    })

    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (hasShortExposure) return 'short_only'
    if (hasLongExposure) return 'long_only'
    return null
  }
}
