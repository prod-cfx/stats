import type { CodegenSemanticPatch } from '@/modules/llm-strategy-codegen/types/codegen-semantic-patch'
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
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'

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

describe('low drawdown Strategy Plaza edit seed codegen', () => {
  it('generates compiled script from the edit seed used by the edit flow', async () => {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === 'low-drawdown-regime-gate')

    expect(template).toBeDefined()
    if (!template) throw new Error('low-drawdown-regime-gate template missing')
    const message = template.editSeed.initialMessage
    const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
    const state = new SemanticSeedStateBuilderService().build(patch, message)

    expect(state).not.toBeNull()
    if (!state) throw new Error('low-drawdown-regime-gate edit seed state missing')
    const artifacts = await createPublicationStage().generate({ semanticState: state })

    expect(artifacts.validation.passed).toBe(true)
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(artifacts.compiledScript).toContain('protocolVersion')
    expect(artifacts.compiledScript).toContain('onBar')
  })
})
