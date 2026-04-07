import type { StrategyLogicGraph } from './logic-graph-model'

export function readCanonicalDigest(
  specDesc: Record<string, unknown> | null | undefined,
): string | null {
  if (!specDesc || typeof specDesc !== 'object' || Array.isArray(specDesc)) {
    return null
  }

  const directDigest = specDesc.canonicalDigest
  if (typeof directDigest === 'string' && directDigest.trim()) {
    return directDigest.trim()
  }

  const confirmation = specDesc.confirmation
  if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
    return null
  }

  const confirmationDigest = (confirmation as { digest?: unknown }).digest
  return typeof confirmationDigest === 'string' && confirmationDigest.trim()
    ? confirmationDigest.trim()
    : null
}

export function canConfirmSemanticView(input: {
  logicGraph: StrategyLogicGraph | null | undefined
  pendingCanonicalDigest: string | null | undefined
}): boolean {
  return Boolean(
    input.logicGraph
      && typeof input.pendingCanonicalDigest === 'string'
      && input.pendingCanonicalDigest.trim(),
  )
}
