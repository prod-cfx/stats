import type { CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CompiledScriptExecutionEnvelopeService {
  build(spec: CanonicalStrategySpecV2): CompiledScriptExecutionEnvelope {
    if (spec.version !== 2) {
      throw new Error('canonical_spec_v2_required')
    }

    const hasShortExposure = spec.rules.some(rule => rule.actions.some(action => (
      action.type === 'OPEN_SHORT'
      || action.type === 'CLOSE_SHORT'
      || action.type === 'REDUCE_SHORT'
    )))

    return {
      positionMode: hasShortExposure ? 'long_short' : 'long_only',
      marginMode: spec.market.marketType === 'perp' ? 'isolated' : 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    }
  }
}
