import type { StrategyDecisionV1 } from '../../strategy-protocol'
import type { CompiledGuardState } from './evaluate-guards'
import type { CompiledOrderState } from './run-order-programs'

interface CompiledManifestLike {
  irHash: string
  specHash: string
  astDigest: string
  structuralDigest: string
}

export function buildCompiledManifest(
  decision: Readonly<StrategyDecisionV1>,
  orderState: Readonly<CompiledOrderState>,
  guardState: Readonly<CompiledGuardState>,
  manifest: Readonly<CompiledManifestLike>,
): StrategyDecisionV1 {
  return {
    ...decision,
    meta: {
      ...(decision.meta ?? {}),
      compiled: true,
      irHash: manifest.irHash,
      specHash: manifest.specHash,
      astDigest: manifest.astDigest,
      structuralDigest: manifest.structuralDigest,
      orderState,
      guardState,
    },
  }
}
