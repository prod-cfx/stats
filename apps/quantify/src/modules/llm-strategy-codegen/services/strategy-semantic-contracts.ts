export interface SemanticContract {
  semanticKey: string
  family: 'trigger' | 'grid'
  requiredParams: string[]
  optionalParams?: string[]
  defaultableParams?: string[]
}

const SEMANTIC_CONTRACTS: Record<string, SemanticContract> = {
  'indicator.above': {
    semanticKey: 'indicator.above',
    family: 'trigger',
    requiredParams: ['indicator', 'referenceRole', 'reference.period', 'confirmationMode'],
  },
  'indicator.below': {
    semanticKey: 'indicator.below',
    family: 'trigger',
    requiredParams: ['indicator', 'referenceRole', 'reference.period', 'confirmationMode'],
  },
  grid_touch: {
    semanticKey: 'grid_touch',
    family: 'grid',
    requiredParams: ['range.lower', 'range.upper', 'stepPct', 'sideMode'],
    defaultableParams: ['recycle'],
  },
}

export function resolveSemanticContract(semanticKey: string): SemanticContract {
  const contract = SEMANTIC_CONTRACTS[semanticKey]
  if (!contract) {
    throw new Error(`Unknown semantic contract: ${semanticKey}`)
  }

  return contract
}
