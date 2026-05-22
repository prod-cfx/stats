import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../strategy-summary-observation.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

function atom(key: string, params: Record<string, unknown> = {}): AtomExprAtom {
  return { kind: 'atom', key, params }
}

function buildSemanticStateWithTypedRules(rules: SemanticRule[]): SemanticState {
  return {
    version: 1,
    families: ['grid'],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ETHUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
      timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
    },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
    rules,
  }
}

function stableConsistencyHash(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
}

function textHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function stripSha256Prefix(value: string): string {
  return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value
}

function createPublicationStage(): CodegenPublicationGenerationStage {
  const profileExtractor = new ScriptProfileExtractorService()
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(profileExtractor),
    new StrategyConsistencyService(profileExtractor),
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

function buildProjectedStateFromMainRulesFlow(text: string): SemanticState {
  const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
  const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
  const state = new SemanticSeedStateBuilderService().build(fallback, text)
  const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null

  if (!projected) {
    throw new Error('stage1_main_rules_flow_projection_missing')
  }

  return projected
}

const hash64Pattern = /^[a-f0-9]{64}$/u

function buildScriptArtifacts(semanticState: SemanticState): {
  canonicalSpec: ReturnType<CanonicalSpecBuilderService['buildFromSemanticState']>
  compiled: ReturnType<CanonicalSpecV2IrCompilerService['compile']>
  ast: ReturnType<CanonicalStrategyAstCompilerService['compile']>
  script: string
  astDigest: string
} {
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
  const fallbackTimeframe = canonicalSpec.dataRequirements.requiredTimeframes[0]
    ?? canonicalSpec.market.defaultTimeframe
    ?? canonicalSpec.market.timeframe
    ?? '15m'
  const compiled = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: {
      exchange: canonicalSpec.market.exchange ?? 'binance',
      symbol: canonicalSpec.market.symbol ?? 'BTCUSDT',
      baseTimeframe: fallbackTimeframe,
      positionPct: 10,
    },
  })
  const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
  const script = new CompiledScriptEmitterService().emit({
    ast,
    executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(canonicalSpec, 'long_short'),
  })
  const astDigest = new CompiledScriptParserService().parse(script).compiledManifest.astDigest

  return { canonicalSpec, compiled, ast, script, astDigest }
}

describe('stage1 corpus to script consistency', () => {
  it('keeps program rules through canonical and script generation', () => {
    const semanticState = buildSemanticStateWithTypedRules([{
      id: 'program-grid-1',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        actions: [],
        risks: [atom('risk.stop_loss_pct', { valuePct: 5, basis: 'entry_avg_price' })],
        positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        orchestration: [atom('scope.symbol', { symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' })],
        programs: [atom('program.fixed_grid_gated', {
          anchorPrice: 3200,
          lowerBound: 3000,
          upperBound: 3400,
          levelCount: 10,
          stepPct: 0.4,
          onDeactivate: 'cancel',
        })],
      },
    }])

    const canonical = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
    const program = canonical.orchestration?.programs?.find(item => item.programKind === 'fixed_grid_gated')

    expect(program).toMatchObject({
      programKind: 'fixed_grid_gated',
      gridParams: {
        anchorPrice: 3200,
        lowerBound: 3000,
        upperBound: 3400,
        levelCount: 10,
        stepPct: 0.4,
      },
      sizing: { mode: 'fixed_quote', value: 10 },
    })
    expect(canonical.orchestration?.scopes).toEqual([
      expect.objectContaining({
        scopeKind: 'symbol',
        symbols: ['ETHUSDT'],
        primarySymbol: 'ETHUSDT',
      }),
    ])
    expect(canonical.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({ key: 'position_loss_pct' }),
      }),
    ]))

    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: canonical,
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: new CompiledScriptExecutionEnvelopeService().build(canonical, 'long_short'),
    })

    expect(JSON.stringify(compiled.ir.orchestrationPrograms)).toContain('fixed_grid_gated')
    expect(script).toContain('ORCHESTRATION_PROGRAMS')
    expect(script).toContain('fixed_grid_gated')
    expect(script).toContain('ETHUSDT')
  })

  it.each(STAGE1_TYPED_RULES_CORPUS)('produces canonical-to-script consistency evidence for %s', (corpusCase) => {
    const semanticState = buildProjectedStateFromMainRulesFlow(corpusCase.text)

    expect(semanticState.rules?.length ?? 0).toBeGreaterThan(0)
    expect(semanticState.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: expect.any(String) }),
    ]))

    const artifacts = buildScriptArtifacts(semanticState)
    const evidence = {
      rulesHash: stableConsistencyHash(semanticState.rules ?? []),
      canonicalSpecHash: stableConsistencyHash(artifacts.canonicalSpec),
      irHash: stableConsistencyHash(artifacts.compiled.ir),
      astHash: stripSha256Prefix(artifacts.astDigest),
      scriptHash: textHash(artifacts.script),
    }
    const semanticConsistency = new StrategyConsistencyService(new ScriptProfileExtractorService()).evaluate({
      canonicalSpec: artifacts.canonicalSpec,
      scriptCode: artifacts.script,
    })

    expect(semanticConsistency.status).toMatch(/^(PASSED|FAILED)$/u)
    expect(semanticConsistency.checks).toEqual(expect.any(Array))
    expect(Object.keys(evidence)).toEqual([
      'rulesHash',
      'canonicalSpecHash',
      'irHash',
      'astHash',
      'scriptHash',
    ])
    for (const value of Object.values(evidence)) {
      expect(value).toMatch(hash64Pattern)
    }
  })

  it('adds stage1 consistency evidence to publication session spec', async () => {
    const corpusCase = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-002-ema-stack-boll-dual-side')
    expect(corpusCase).toBeDefined()

    const semanticState = buildProjectedStateFromMainRulesFlow(corpusCase!.text)
    const artifacts = await createPublicationStage().generate({ semanticState })
    const expectedEvidence = {
      rulesHash: stableConsistencyHash(semanticState.rules ?? []),
      canonicalSpecHash: stableConsistencyHash(artifacts.canonicalSpec),
      irHash: stableConsistencyHash(artifacts.compiled.ir),
      astHash: stripSha256Prefix(new CompiledScriptParserService().parse(artifacts.compiledScript).compiledManifest.astDigest),
      scriptHash: textHash(artifacts.compiledScript),
    }

    expect(artifacts.semanticConsistency.status).toBe('PASSED')
    expect(artifacts.sessionSpecDesc).toMatchObject({
      stage1ConsistencyEvidence: expectedEvidence,
    })
    for (const value of Object.values(expectedEvidence)) {
      expect(value).toMatch(hash64Pattern)
    }
  })
})
