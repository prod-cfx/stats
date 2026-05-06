export interface AtomicRuntimeRequirements {
  helpers: string[]
  stateKeys: string[]
}

export type SemanticRuntimeState = Record<string, Record<string, unknown>>

export function buildSemanticRuntimeState(stateKeys: readonly string[]): SemanticRuntimeState {
  return uniqueStrings(stateKeys).reduce<SemanticRuntimeState>((state, key) => {
    state[key] = {}
    return state
  }, {})
}

export function readAtomicRuntimeRequirementsFromSnapshot(snapshot: unknown): AtomicRuntimeRequirements | null {
  const root = readRecord(snapshot)
  if (!root) return null

  const compatibilityRequirements = readCompatibilityRuntimeRequirements(root)
  if (compatibilityRequirements) return compatibilityRequirements

  const candidates = [
    readRecord(root.astSnapshot)?.runtimeRequirements,
    readRecord(root.irSnapshot)?.runtimeRequirements,
    readRecord(root.compiledIr)?.runtimeRequirements,
    root.runtimeRequirements,
  ]

  for (const candidate of candidates) {
    const requirements = normalizeRuntimeRequirements(candidate)
    if (requirements) return requirements
  }

  return null
}

export function normalizeRuntimeRequirements(value: unknown): AtomicRuntimeRequirements | null {
  const record = readRecord(value)
  if (!record) return null

  const helpers = readStringArray(record.helpers)
  const stateKeys = readStringArray(record.stateKeys)
  if (helpers.length === 0 && stateKeys.length === 0) return null

  return {
    helpers,
    stateKeys,
  }
}

function readCompatibilityRuntimeRequirements(root: Record<string, unknown>): AtomicRuntimeRequirements | null {
  const compatibilityCandidates = [
    readRecord(root.compatibilityMetadata),
    readRecord(readRecord(root.scriptSummary)?.compatibilityMetadata),
    readRecord(readRecord(root.strategySummary)?.compatibilityMetadata),
    readRecord(readRecord(root.compiledManifest)?.compatibilityMetadata),
  ]

  for (const compatibilityMetadata of compatibilityCandidates) {
    const atomicContractExecution = readRecord(compatibilityMetadata?.atomicContractExecution)
    const requirements = normalizeRuntimeRequirements(atomicContractExecution?.runtimeRequirements)
    if (requirements) return requirements
  }

  return null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return uniqueStrings(value.filter((item): item is string => typeof item === 'string'))
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}
