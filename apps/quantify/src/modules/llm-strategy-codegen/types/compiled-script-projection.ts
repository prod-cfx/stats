import type { StrategyAstV1 } from './canonical-strategy-ast'
import type { HashString, IrOrchestrationLegScope, IrOrchestrationPortfolioRisk, IrOrchestrationProgram, IrOrchestrationScope } from './canonical-strategy-ir'

export interface CompiledScriptExecutionEnvelope {
  positionMode: 'long_only' | 'short_only' | 'long_short'
  marginMode: 'cash' | 'isolated' | 'cross'
  tickSize: number
  pricePrecision: number
  quantityPrecision: number
  fillAssumption: 'strict' | 'optimistic'
}

export interface CompiledStrategyManifest {
  irVersion: 'csi.v1'
  astVersion: 'csa.v1'
  compileVersion: 'compiler.v1'
  irHash: HashString
  specHash: HashString
  astDigest: HashString
  structuralDigest: HashString
}

export interface CompiledScriptProjection {
  compiledManifest: CompiledStrategyManifest
  executionModel: StrategyAstV1['executionModel'] & CompiledScriptExecutionEnvelope
  dataRequirements: StrategyAstV1['dataRequirements']
  runtimeRequirements?: StrategyAstV1['runtimeRequirements']
  exprPool: StrategyAstV1['exprPool']
  guards: StrategyAstV1['guards']
  riskPredicates?: StrategyAstV1['riskPredicates']
  decisionPrograms: StrategyAstV1['decisionPrograms']
  orderPrograms: StrategyAstV1['orderPrograms']
  orchestrationPortfolioRisks?: IrOrchestrationPortfolioRisk[]
  orchestrationPrograms?: IrOrchestrationProgram[]
  // Phase 5 S2 (#1104): scope.symbol substrate
  orchestrationScopes?: IrOrchestrationScope[]
  // Phase 5 S11 (#1112): scope.leg substrate
  orchestrationLegScopes?: IrOrchestrationLegScope[]
  topology: StrategyAstV1['topology']
}
