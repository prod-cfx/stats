export { buildCompiledManifest } from './compiled-runtime/build-compiled-manifest'
export { canonicalSerialize } from './compiled-runtime/canonical-serialize'
export { evaluateExprPool, invalidateMemoryOperand } from './compiled-runtime/evaluate-expr-pool'
export { evaluateGuards } from './compiled-runtime/evaluate-guards'
export { isNaturalSweepCombination, liquiditySweepDetector } from './compiled-runtime/liquidity-sweep-detector'
export type { LiquiditySweepDetectorInput, LiquiditySweepDirection, LiquiditySweepReference } from './compiled-runtime/liquidity-sweep-detector'
export { evaluateRiskPredicates } from './compiled-runtime/evaluate-risk-predicates'
export {
  runDecisionPrograms,
  applySymbolScopeRouting,
  applyLegScopeRouting,
  applyTimeframeScopeAlignment,
  applyDataSourceScopeFailClosed,
  applyDataSourceScopeProgramRouting,
  applySubStrategyScopeRouting,
} from './compiled-runtime/run-decision-programs'
export type {
  CompiledOrchestrationScope,
  CompiledSymbolScope,
  CompiledOrchestrationLegScope,
  CompiledOrchestrationLegSizing,
  CompiledTimeframeScope,
  TimeframeBarStatusEntry,
  CompiledOrchestrationDataSourceScope,
  CompiledOrchestrationDataSourceRole,
  CompiledOrchestrationDataSourceSchema,
  CompiledSubStrategyScope,
} from './compiled-runtime/run-decision-programs'
// Phase 5 S3 (#1109)
export { parseTimeframeMs, SUPPORTED_TIMEFRAMES, TIMEFRAME_MS } from './compiled-runtime/parse-timeframe-ms'
export { runOrderPrograms } from './compiled-runtime/run-order-programs'
export type { ProgramLifecycleState } from './compiled-runtime/program-lifecycle-state'
// Phase 5 S2 follow-up (#1108): scope.symbol fan-out caller wrapper
export {
  buildScopeIteration,
  runDecisionProgramsFanOut,
} from './compiled-runtime/apply-symbol-scope-fanout'
export type {
  ScopeFanOutDecisionEntry,
  SymbolScopeIterationInput,
} from './compiled-runtime/apply-symbol-scope-fanout'
// Phase 5 S10 follow-up (#1113): scope.subStrategy fan-out caller wrapper
export {
  buildSubStrategyScopeIteration,
  resolveSubStrategySwitch,
  runDecisionProgramsSubStrategyFanOut,
  synthesizeSubStrategyDeactivationDecision,
} from './compiled-runtime/apply-substrategy-scope-fanout'
export type {
  SubStrategyDeactivationMeta,
  SubStrategyFanOutInvocation,
  SubStrategyFanOutResult,
  SubStrategyScopeIterationInput,
  SubStrategySwitchInput,
  SubStrategySwitchOutcome,
} from './compiled-runtime/apply-substrategy-scope-fanout'
