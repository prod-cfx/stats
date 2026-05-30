export const STAGE4_BLOCKER_TAXONOMY = [
  'missing_semantics',
  'extra_semantics',
  'semantic_drift',
  'duplicated_entry',
  'duplicated_exit',
  'wrong_effect_role',
  'wrong_slot_path',
  'slot_answer_created_duplicate_rule',
  'script_semantics_drift',
  'deploy_payload_drift',
  'dialogue_unrecognized',
  'rules_schema_rejected',
  'readiness_missing_slot',
  'canonical_unsupported_atom',
  'ir_compile_missing_branch',
  'runtime_missing_data',
  'data_source_missing',
  'backtest_rejected',
  'deploy_payload_missing_binding',
  'attempt_not_one',
  'unstable_rerun',
  'expected_blocker_missing',
  'fake_deploy_payload',
] as const

export type Stage4BlockerKind = typeof STAGE4_BLOCKER_TAXONOMY[number]

export interface Stage4SemanticHashChain {
  readonly rulesHash: string
  readonly displayGraphHash: string
  readonly canonicalSpecHash: string
  readonly irHash: string
  readonly astHash: string
  readonly scriptHash: string
  readonly deployPayloadHash: string
  readonly runtimeEvaluatorVersion: string
}

export interface Stage4DialogueAttemptResult {
  readonly attemptCount: number
  readonly passed: boolean
  readonly semanticHashesStable: boolean
  readonly blocker?: Stage4BlockerKind | null
  readonly hashChain?: Stage4SemanticHashChain
}

export function isStage4AttemptOnePass(result: Pick<Stage4DialogueAttemptResult, 'attemptCount' | 'passed' | 'semanticHashesStable'>): boolean {
  return result.attemptCount === 1 && result.passed && result.semanticHashesStable
}
