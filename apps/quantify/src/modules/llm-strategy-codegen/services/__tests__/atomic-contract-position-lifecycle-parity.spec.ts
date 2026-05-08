import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { SemanticState } from '../../types/semantic-state'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'
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
type ExprValues = Parameters<typeof runDecisionPrograms>[2]
type GuardState = Parameters<typeof runDecisionPrograms>[3]

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

function exprValuesForPrograms(programs: DecisionPrograms): ExprValues {
  return Object.fromEntries(programs.map(program => [program.when, true])) as ExprValues
}

function createRuntimeContext(): DecisionContext {
  return {
    position: { side: 'long', qty: 1 },
    currentPrice: 100,
    accountEquity: 1_000,
    semanticRuntimeState: {
      pyramiding_layer_count: {},
    },
  } as DecisionContext
}

describe('atomic contract position lifecycle compiled parity', () => {
  it('preserves add_position metadata through compiler.v1 parse and returns identical runtime decisions', () => {
    const ast = compileLifecycleMessage('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')
    const script = new CompiledScriptEmitterService().emit({
      ast,
      executionEnvelope: createExecutionEnvelope(),
    })
    const parsed = new CompiledScriptParserService().parse(script)

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

    const decisionPrograms = parsed.decisionPrograms as DecisionPrograms
    const exprValues = exprValuesForPrograms(decisionPrograms)
    const guardState = {} as GuardState
    const decisionOrder = parsed.topology.decisionOrder

    const backtestStyleDecision = runDecisionPrograms(
      createRuntimeContext(),
      decisionPrograms,
      exprValues,
      guardState,
      decisionOrder,
    )
    const liveStyleDecision = runDecisionPrograms(
      createRuntimeContext(),
      decisionPrograms,
      exprValues,
      guardState,
      decisionOrder,
    )

    expect(backtestStyleDecision).toEqual(liveStyleDecision)
    expect(backtestStyleDecision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
    })
  })
})
