import type { CodegenSemanticPatch } from '@/modules/llm-strategy-codegen/types/codegen-semantic-patch'
import { STAGE4_ATOM_COVERAGE_MATRIX, isStage4DeployReadyAtom } from '@/modules/llm-strategy-codegen/stage4/atom-coverage-matrix'
import { STAGE4_REAL_STRATEGY_CORPUS } from '@/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus'
import { CanonicalSpecBuilderService } from '@/modules/llm-strategy-codegen/services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '@/modules/llm-strategy-codegen/services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '@/modules/llm-strategy-codegen/services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '@/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '@/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '@/modules/llm-strategy-codegen/services/script-profile-extractor.service'
import { SemanticSeedStateBuilderService } from '@/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '@/modules/llm-strategy-codegen/services/spec-desc-builder.service'
import { StrategyConsistencyService } from '@/modules/llm-strategy-codegen/services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '@/modules/llm-strategy-codegen/services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '@/modules/llm-strategy-codegen/services/strategy-summary-observation.service'

function createPublicationStage(): CodegenPublicationGenerationStage {
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new StrategySummaryObservationService(),
    undefined,
    new CodegenGraphSnapshotService(),
  )
}

function buildSemanticState(message: string) {
  const semanticPatch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
  const state = new SemanticSeedStateBuilderService().build(semanticPatch, message)

  expect(state).not.toBeNull()
  expect(state?.rules?.length ?? 0).toBeGreaterThan(0)

  return state!
}

function coverageRowsForAtomKey(atomKey: string) {
  return STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.atomKey === atomKey || row.coveredAtomKeys.includes(atomKey))
}

describe('Stage 4 rules-only atom corpus e2e', () => {
  it.each(STAGE4_REAL_STRATEGY_CORPUS.filter(item => item.expectedFailure === null))(
    '$id reaches canonical spec, IR, AST, script, and deploy payload shape on attempt-1',
    async (item) => {
      for (const atomKey of item.expectedAtomKeys) {
        expect(coverageRowsForAtomKey(atomKey).some(isStage4DeployReadyAtom)).toBe(true)
      }

      const state = buildSemanticState(item.initialUserMessage)
      const artifacts = await createPublicationStage().generate({ semanticState: state })

      expect(artifacts.canonicalSpec.rules.length).toBeGreaterThan(0)
      expect(artifacts.compiled.ir.ruleBlocks.length).toBeGreaterThan(0)
      expect(artifacts.ast.decisionPrograms.length).toBeGreaterThan(0)
      expect(artifacts.compiledScript).toContain('protocolVersion')
      expect(artifacts.compiledScript).toContain('onBar')
      expect(artifacts.validation.passed).toBe(true)
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      expect(artifacts.publishParams.symbol).toBeTruthy()
      expect(artifacts.publishParams.timeframe).toBeTruthy()
      expect(JSON.stringify(artifacts)).toContain('rules[')
    },
  )

  it.each(STAGE4_REAL_STRATEGY_CORPUS.filter(item => item.expectedFailure !== null))(
    '$id stays fail-closed before deploy payload when atom runtime support is incomplete',
    (item) => {
      const blockerRows = item.expectedAtomKeys
        .flatMap(atomKey => coverageRowsForAtomKey(atomKey).map(row => ({ atomKey, row })))
        .filter(({ row }) => !isStage4DeployReadyAtom(row) && row.unsupportedReason === item.expectedFailure)

      expect(blockerRows.length).toBeGreaterThan(0)
      expect(blockerRows.every(({ row }) => row.reachesBacktest === false || row.reachesDeployPayload === false)).toBe(true)
    },
  )
})
