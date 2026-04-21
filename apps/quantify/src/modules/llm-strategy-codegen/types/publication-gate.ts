export interface PublicationGateCheck {
  key: string
  blocking: boolean
  status: 'passed' | 'failed' | 'unprovable'
  expected: unknown
  actual: unknown
  message: string
}

export interface PublicationGateReport {
  status: 'PASSED' | 'FAILED'
  checks: PublicationGateCheck[]
}

export interface PublishedRuntimeExecutionSemanticRequiredRuntimeContext {
  barIndex?: number
  requiresReferenceBar?: boolean
  requiresSymbol?: boolean
  requiresTimeframe?: boolean
}

export interface PublishedRuntimeExecutionSemantic {
  semanticKey: string
  trigger: 'on_start'
  phase: 'entry' | 'exit' | 'rebalance'
  consumePolicy: 'once'
  requiredRuntimeContext: PublishedRuntimeExecutionSemanticRequiredRuntimeContext
  sourceRefs: string[]
}

export type PublishedStrategyAstSnapshot = Record<string, unknown> & {
  runtimeExecutionSemantics?: PublishedRuntimeExecutionSemantic[]
}
