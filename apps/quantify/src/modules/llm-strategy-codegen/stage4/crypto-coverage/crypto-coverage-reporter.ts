import type {
  CryptoAtomEvidence,
  CryptoCaseEvidence,
  CryptoCoverageBacklogItem,
  CryptoCoverageFailure,
  CryptoCoverageFailureKind,
  CryptoCoverageLayer,
  CryptoCoverageReport,
  CryptoUnsupportedIntent,
} from './crypto-coverage-types'
import { buildCryptoCoverageTaxonomyEvidence } from './crypto-coverage-evidence'
import { isBCoverageSupportedStatus } from './crypto-coverage-taxonomy'

const FAILURE_LAYER: Readonly<Record<CryptoCoverageFailureKind, CryptoCoverageLayer>> = {
  missing_nl_dispatch: 'nl_dispatch',
  missing_dialogue_slot: 'dialogue_slot',
  missing_rules_emit: 'rules_emit',
  missing_atom_contract: 'atom_contract',
  missing_readiness_support: 'readiness_support',
  missing_canonical_emit: 'canonical_emit',
  missing_ir_emit: 'ir_emit',
  missing_runtime_data: 'runtime_data',
  missing_execution_runtime: 'execution_runtime',
  missing_backtest_reachability: 'backtest_reachability',
  missing_deploy_payload: 'deploy_payload',
  ghost_atom: 'unsupported_gate',
  out_of_scope_C: 'unsupported_gate',
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2))
}

function backlogPhase(kind: CryptoCoverageFailureKind): 'P2' | 'P3' {
  return kind === 'missing_runtime_data'
    || kind === 'missing_execution_runtime'
    || kind === 'missing_backtest_reachability'
    || kind === 'missing_deploy_payload'
    ? 'P3'
    : 'P2'
}

function buildBacklog(atoms: readonly CryptoAtomEvidence[]): CryptoCoverageBacklogItem[] {
  return atoms.flatMap((atom) => {
    if (atom.scope !== 'B' || isBCoverageSupportedStatus(atom.status)) return []
    return atom.failures.map(failureKind => ({
      atomKey: atom.atomKey,
      requiredPhase: backlogPhase(failureKind),
      failureKind,
      ownerLayer: FAILURE_LAYER[failureKind],
    }))
  })
}

export function buildCryptoCoverageReport(input: {
  readonly atoms: readonly CryptoAtomEvidence[]
  readonly cases: readonly CryptoCaseEvidence[]
  readonly unsupported: readonly CryptoUnsupportedIntent[]
}): CryptoCoverageReport {
  const bAtoms = input.atoms.filter(atom => atom.scope === 'B')
  const supportedWeight = bAtoms
    .filter(atom => isBCoverageSupportedStatus(atom.status))
    .reduce((sum, atom) => sum + atom.weight, 0)
  const totalWeight = bAtoms.reduce((sum, atom) => sum + atom.weight, 0)
  const passCases = input.cases.filter(item => item.passed).length
  const failures: CryptoCoverageFailure[] = input.cases.flatMap(item => item.failures)

  return {
    summary: {
      totalCases: input.cases.length,
      passCases,
      passPct: pct(passCases, input.cases.length),
      weightedBCoveragePct: pct(supportedWeight, totalWeight),
      unsupportedCCount: input.unsupported.length,
    },
    taxonomy: buildCryptoCoverageTaxonomyEvidence(input.cases),
    cases: input.cases,
    atoms: input.atoms,
    failures,
    backlog: buildBacklog(input.atoms),
    unsupported: input.unsupported,
  }
}
