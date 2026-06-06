import type { CodegenSemanticPatch } from '@/modules/llm-strategy-codegen/types/codegen-semantic-patch'
import type { AtomExprAtom, SemanticRule } from '@/modules/llm-strategy-codegen/types/atom-expr'
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
import { SemanticStateProjectionService } from '@/modules/llm-strategy-codegen/services/semantic-state-projection.service'
import { collectAtomLeaves, listRuleEffects } from '@/modules/llm-strategy-codegen/types/atom-expr'
import type { SemanticState } from '@/modules/llm-strategy-codegen/types/semantic-state'
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

function getTemplateInitialMessage(templateId: string): string {
  const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === templateId)
  if (!template) throw new Error(`${templateId} template missing`)
  return template.editSeed.initialMessage
}

function buildStateFromMessage(message: string): SemanticState {
  const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
  const state = new SemanticSeedStateBuilderService().build(patch, message)
  if (!state) throw new Error('semantic seed state missing')
  return state
}

function buildRulesFromMessage(message: string): readonly SemanticRule[] {
  return buildStateFromMessage(message).rules ?? []
}

function collectRuleAtoms(rules: readonly SemanticRule[]): AtomExprAtom[] {
  return rules.flatMap(rule => [
    ...collectAtomLeaves(rule.condition),
    ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
  ])
}

function findRuleAtom(rules: readonly SemanticRule[], key: string): AtomExprAtom | undefined {
  return collectRuleAtoms(rules).find(atom => atom.key === key)
}

describe('Strategy Plaza official edit seed rules mainflow codegen', () => {
  it.each([
    'low-drawdown-regime-gate',
    'orderbook-imbalance-long',
    'fixed-grid-gated',
  ])('%s generates compiled script from the edit seed used by the edit flow', async (templateId) => {
    const message = getTemplateInitialMessage(templateId)
    const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
    const state = new SemanticSeedStateBuilderService().build(patch, message)

    expect(state).not.toBeNull()
    if (!state) throw new Error(`${templateId} edit seed state missing`)
    const artifacts = await createPublicationStage().generate({ semanticState: state })

    expect(artifacts.validation.passed).toBe(true)
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(artifacts.compiledScript).toContain('protocolVersion')
    expect(artifacts.compiledScript).toContain('onBar')
  })

  it('keeps orderbook imbalance as an entry predicate in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('orderbook-imbalance-long'))
    const orderbookImbalance = findRuleAtom(rules, 'orderbook.imbalance')
    const entryRule = rules.find(rule => rule.phase === 'entry')
    const entryConditionKeys = entryRule ? collectAtomLeaves(entryRule.condition).map(atom => atom.key) : []

    expect(orderbookImbalance).toBeDefined()
    expect(orderbookImbalance?.params).toMatchObject({ operator: 'gt', ratio: 1.5 })
    expect(entryConditionKeys).toEqual(expect.arrayContaining(['indicator.cross_over', 'orderbook.imbalance']))
    expect(entryConditionKeys).not.toContain('gate.regime')
  })

  it('keeps fixed grid range count and step in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('fixed-grid-gated'))
    const fixedGrid = findRuleAtom(rules, 'program.fixed_grid_gated')

    expect(fixedGrid).toBeDefined()
    expect(fixedGrid?.params).toMatchObject({
      programKind: 'fixed_grid_gated',
      lowerBound: 50000,
      upperBound: 60000,
      levelCount: 10,
      stepPct: 5,
    })
  })

  it('renders orderbook imbalance instead of an EMA-only precondition in confirmation summary', () => {
    const view = new SemanticStateProjectionService().buildConversationView(buildStateFromMessage(getTemplateInitialMessage('orderbook-imbalance-long')))

    expect(view.summary).toContain('盘口失衡')
    expect(view.summary).toContain('EMA20 上穿 EMA50')
    expect(view.summary).not.toContain('只在价格高于 EMA')
    expect(view.summary).not.toContain('只在价格低于 EMA')
  })

  it('renders fixed grid explicit range count and step in confirmation summary', () => {
    const view = new SemanticStateProjectionService().buildConversationView(buildStateFromMessage(getTemplateInitialMessage('fixed-grid-gated')))

    expect(view.summary).toContain('50000-60000')
    expect(view.summary).toContain('10 档')
    expect(view.summary).toContain('5%')
    expect(view.summary).not.toContain('挂 0 档')
    expect(view.summary).not.toContain('步长 0%')
  })
})
