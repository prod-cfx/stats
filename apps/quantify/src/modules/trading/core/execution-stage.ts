export const EXECUTION_STAGES = [
  'RESOLVED_ACCOUNT',
  'PRECHECK_PASSED',
  'ORDER_SUBMITTED',
  'ORDER_ACKED',
  'LEDGER_APPLIED',
  'RECONCILE_REQUIRED',
  'COMPLETED',
] as const

export type ExecutionStage = (typeof EXECUTION_STAGES)[number]
