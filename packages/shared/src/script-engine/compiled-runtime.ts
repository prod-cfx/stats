export { buildCompiledManifest } from './compiled-runtime/build-compiled-manifest'
export { canonicalSerialize } from './compiled-runtime/canonical-serialize'
export { evaluateExprPool, invalidateMemoryOperand } from './compiled-runtime/evaluate-expr-pool'
export { evaluateGuards } from './compiled-runtime/evaluate-guards'
export { isNaturalSweepCombination, liquiditySweepDetector } from './compiled-runtime/liquidity-sweep-detector'
export type { LiquiditySweepDetectorInput, LiquiditySweepDirection, LiquiditySweepReference } from './compiled-runtime/liquidity-sweep-detector'
export { evaluateRiskPredicates } from './compiled-runtime/evaluate-risk-predicates'
export { runDecisionPrograms, applySymbolScopeRouting, applyLegScopeRouting } from './compiled-runtime/run-decision-programs'
export type { CompiledOrchestrationScope, CompiledOrchestrationLegScope, CompiledOrchestrationLegSizing } from './compiled-runtime/run-decision-programs'
export { runDecisionPrograms, applySymbolScopeRouting, applyTimeframeScopeAlignment } from './compiled-runtime/run-decision-programs'
export type {
  CompiledOrchestrationScope,
  CompiledSymbolScope,
  CompiledTimeframeScope,
  TimeframeBarStatusEntry,
} from './compiled-runtime/run-decision-programs'
// Phase 5 S3 (#1109)
export { parseTimeframeMs, SUPPORTED_TIMEFRAMES, TIMEFRAME_MS } from './compiled-runtime/parse-timeframe-ms'
export { runOrderPrograms } from './compiled-runtime/run-order-programs'
export type { ProgramLifecycleState } from './compiled-runtime/program-lifecycle-state'
