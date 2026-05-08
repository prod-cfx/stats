import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptProjection } from '../../types/compiled-script-projection'
import type { SemanticState } from '../../types/semantic-state'
import {
  evaluateExprPool,
  evaluateGuards,
  evaluateRiskPredicates,
  runDecisionPrograms,
} from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

type DecisionPrograms = Parameters<typeof runDecisionPrograms>[1]
type DecisionContext = Parameters<typeof runDecisionPrograms>[0]

function compileLifecycleMessage(message: string): StrategyAstV1 {
  const extractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
  const readiness = new SemanticContractReadinessService()

  const patch = extractor.extract(message)
  const seedState = seedStateBuilder.build(patch)
  if (!seedState) {
    throw new Error('semantic_state_not_built')
  }

  const classified = classifier.classify(seedState)
  const normalized = readiness.normalize(classified.state)

  expect(classified.route).toBe('projection_gate')
  expect(normalized.ready).toBe(true)

  const canonicalBuilder = new CanonicalSpecBuilderService()
  const buildInput: Parameters<CanonicalSpecBuilderService['build']>[0] & { semanticState: SemanticState } = {
    semanticState: normalized.state,
    market: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '1h',
    },
  }
  const spec = canonicalBuilder.build(buildInput)
  const ir = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec: spec,
    fallback: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
      positionPct: 10,
    },
  }).ir
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)

  return ast
}

function createExecutionEnvelope() {
  return {
    positionMode: 'long_only' as const,
    marginMode: 'isolated' as const,
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict' as const,
  }
}

function runParsedCompiledPipeline(
  parsed: CompiledScriptProjection,
  ctx: DecisionContext,
) {
  const exprValues = evaluateExprPool(
    ctx,
    parsed.exprPool as Parameters<typeof evaluateExprPool>[1],
    parsed.topology.exprOrder,
    parsed.executionModel as unknown as Parameters<typeof evaluateExprPool>[3],
  )
  const baseGuardState = evaluateGuards(
    ctx,
    parsed.guards as Parameters<typeof evaluateGuards>[1],
    exprValues,
    parsed.topology.guardOrder,
  )
  const guardState = evaluateRiskPredicates(
    ctx,
    parsed.riskPredicates as Parameters<typeof evaluateRiskPredicates>[1],
    baseGuardState,
    parsed.topology.riskPredicateOrder,
  )
  const decision = runDecisionPrograms(
    ctx,
    parsed.decisionPrograms as DecisionPrograms,
    exprValues,
    guardState,
    parsed.topology.decisionOrder,
  )

  return { decision, exprValues, guardState }
}

function createRuntimeContext(): DecisionContext {
  return {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    bars: createMa20ReclaimBars(),
    position: { side: 'long', qty: 1 },
    currentPrice: 110,
    accountEquity: 1_000,
    semanticRuntimeState: {
      pyramiding_layer_count: {},
    },
  } as DecisionContext
}

function cloneRuntimeContext(): DecisionContext {
  return structuredClone(createRuntimeContext()) as DecisionContext
}

function createMa20ReclaimBars() {
  const previousBars = Array.from({ length: 20 }, (_, index) => ({
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
    timestamp: index + 1,
  }))

  return [
    ...previousBars,
    {
      open: 100,
      high: 111,
      low: 99,
      close: 110,
      volume: 10,
      timestamp: 21,
    },
  ]
}

describe('atomic contract position lifecycle compiled parity', () => {
  it('preserves add_position metadata through compiler.v1 parse and returns identical runtime decisions', () => {
    const ast = compileLifecycleMessage('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: createExecutionEnvelope(),
    })
    const parsed = new CompiledScriptParserService().parse(script)

    const addProgram = parsed.decisionPrograms.find(program =>
      program.actions.some(action => action.kind === 'ADD_LONG'),
    )

    expect(parsed.decisionPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'ADD_LONG' }),
        ]),
        metadata: expect.objectContaining({
          addPosition: expect.objectContaining({
            stateKey: 'pyramiding_layer_count',
          }),
        }),
      }),
    ]))

    expect(addProgram).toBeDefined()
    if (!addProgram) {
      throw new Error('add_program_not_found')
    }

    const backtestStyleRun = runParsedCompiledPipeline(parsed, cloneRuntimeContext())
    const liveStyleRun = runParsedCompiledPipeline(parsed, cloneRuntimeContext())

    expect(backtestStyleRun.exprValues[addProgram.when]).toBe(true)
    expect(backtestStyleRun.guardState.forceExit).toBe(false)

    expect(backtestStyleRun.decision).toEqual(liveStyleRun.decision)
    expect(backtestStyleRun.decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
    })
  })
})
