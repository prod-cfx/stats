export type CryptoCoverageScope = 'B' | 'C'

export type CryptoCoverageLayer =
  | 'nl_dispatch'
  | 'dialogue_slot'
  | 'rules_emit'
  | 'atom_contract'
  | 'readiness_support'
  | 'canonical_emit'
  | 'ir_emit'
  | 'runtime_data'
  | 'execution_runtime'
  | 'backtest_reachability'
  | 'deploy_payload'
  | 'unsupported_gate'

export type CryptoCoverageFailureKind =
  | 'missing_nl_dispatch'
  | 'missing_dialogue_slot'
  | 'missing_rules_emit'
  | 'missing_atom_contract'
  | 'missing_readiness_support'
  | 'missing_canonical_emit'
  | 'missing_ir_emit'
  | 'missing_runtime_data'
  | 'missing_execution_runtime'
  | 'missing_backtest_reachability'
  | 'missing_deploy_payload'
  | 'ghost_atom'
  | 'out_of_scope_C'

export type CryptoCoverageSupportStatus =
  | 'supported_executable'
  | 'planned_executable'
  | 'blocked_by_missing_nl_dispatch'
  | 'blocked_by_missing_dialogue_slot'
  | 'blocked_by_missing_rules_emit'
  | 'blocked_by_missing_atom_contract'
  | 'blocked_by_missing_readiness_support'
  | 'blocked_by_missing_canonical_emit'
  | 'blocked_by_missing_ir_emit'
  | 'blocked_by_missing_runtime_data'
  | 'blocked_by_missing_execution_runtime'
  | 'blocked_by_missing_backtest_reachability'
  | 'blocked_by_missing_deploy_payload'
  | 'unsupported_out_of_scope'

export interface CryptoClarificationTurn {
  readonly assistantSlotPath: string
  readonly userAnswer: string
}

export interface CryptoStrategyCoverageCase {
  readonly id: string
  readonly labels: readonly string[]
  readonly scope: CryptoCoverageScope
  readonly initialUserMessage: string
  readonly clarificationTurns: readonly CryptoClarificationTurn[]
  readonly expectedAtomKeys: readonly string[]
  readonly expectedUnsupportedReason?: string
}

export interface CryptoCoverageFailure {
  readonly caseId: string
  readonly atomKey: string
  readonly layer: CryptoCoverageLayer
  readonly kind: CryptoCoverageFailureKind
  readonly evidence: string
}

export interface CryptoAtomEvidence {
  readonly atomKey: string
  readonly scope: CryptoCoverageScope
  readonly weight: number
  readonly status: CryptoCoverageSupportStatus
  readonly layers: Readonly<Record<CryptoCoverageLayer, boolean>>
  readonly failures: readonly CryptoCoverageFailureKind[]
}

export interface CryptoCaseEvidence {
  readonly id: string
  readonly labels: readonly string[]
  readonly scope: CryptoCoverageScope
  readonly passed: boolean
  readonly expectedAtomKeys: readonly string[]
  readonly observedAtomKeys: readonly string[]
  readonly failures: readonly CryptoCoverageFailure[]
}

export interface CryptoCoverageBacklogItem {
  readonly atomKey: string
  readonly requiredPhase: 'P2' | 'P3'
  readonly failureKind: CryptoCoverageFailureKind
  readonly ownerLayer: CryptoCoverageLayer
}

export interface CryptoUnsupportedIntent {
  readonly caseId: string
  readonly matchedPhrase: string
  readonly status: 'unsupported_out_of_scope'
  readonly publicReason: string
}

export interface CryptoCoverageReport {
  readonly summary: {
    readonly totalCases: number
    readonly passCases: number
    readonly passPct: number
    readonly weightedBCoveragePct: number
    readonly unsupportedCCount: number
  }
  readonly cases: readonly CryptoCaseEvidence[]
  readonly atoms: readonly CryptoAtomEvidence[]
  readonly failures: readonly CryptoCoverageFailure[]
  readonly backlog: readonly CryptoCoverageBacklogItem[]
  readonly unsupported: readonly CryptoUnsupportedIntent[]
}
