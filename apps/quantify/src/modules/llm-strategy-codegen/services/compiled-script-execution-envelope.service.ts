import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CompiledScriptExecutionEnvelopeService {
  build(
    spec: CanonicalStrategySpecV2,
    explicitPositionMode: CompiledScriptExecutionEnvelope['positionMode'] | null = null,
  ): CompiledScriptExecutionEnvelope {
    if (spec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }

    const hasLongExposure = spec.rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_LONG'
    )))
    const hasShortExposure = spec.rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
    )))
    const inferredPositionMode = hasLongExposure && hasShortExposure
      ? 'long_short'
      : hasShortExposure
        ? 'short_only'
        : 'long_only'

    return {
      positionMode: explicitPositionMode ?? inferredPositionMode,
      marginMode: spec.market.marketType === 'perp' ? 'isolated' : 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    }
  }
}
