import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

interface CompiledLifecycle {
  spec: CanonicalStrategySpecV2
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
}

function compileLifecycleMessage(message: string): CompiledLifecycle {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
  const readiness = new SemanticContractReadinessService()

  const patch = extractor.extract(message)
  const seedState = builder.build(patch)
  if (!seedState) {
    throw new Error('semantic_state_not_built')
  }

  const normalized = readiness.normalize(classifier.classify(seedState).state)
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

  return { spec, ir, ast }
}

describe('atomic contract position lifecycle canonical IR projection', () => {
  it('compiles reduce_position into REDUCE_LONG with position percentage sizing', () => {
    const { ir } = compileLifecycleMessage('盈利 5% 后减仓 30%。')

    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['positionLifecycle']))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          {
            kind: 'REDUCE_LONG',
            quantity: { mode: 'position_pct', value: 30 },
          },
        ]),
      }),
    ]))
  })

  it('binds exit trigger groups to reduce_position before generic close actions', () => {
    const { ir } = compileLifecycleMessage('RSI 高于 70 卖出减仓 30%。')

    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        actions: [
          {
            kind: 'REDUCE_LONG',
            quantity: { mode: 'position_pct', value: 30 },
          },
        ],
      }),
    ]))
    expect(ir.ruleBlocks.some(block => block.actions.some(action => action.kind === 'CLOSE_LONG'))).toBe(false)
  })

  it('compiles add_position constraints into pyramiding portfolio and runtime state', () => {
    const { ir } = compileLifecycleMessage('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')

    expect(ir.portfolio.allowPyramiding).toBe(true)
    expect(ir.portfolio.maxPyramidingLayers).toBe(3)
    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['positionLifecycle']))
    expect(ir.runtimeRequirements?.stateKeys).toEqual(expect.arrayContaining(['pyramiding_layer_count']))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          {
            kind: 'ADD_LONG',
            quantity: { mode: 'pct_equity', value: 20 },
          },
        ]),
      }),
    ]))
  })

  it('compiles DCA drop triggers as downside price-change predicates', () => {
    const { spec, ir, ast } = compileLifecycleMessage('每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，跌破前低停止。')

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'LTE',
          value: -0.05,
        }),
      }),
    ]))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          dcaSchedule: expect.objectContaining({
            maxCount: 4,
            stateKey: 'dca_fired_count',
          }),
        }),
        actions: [
          {
            kind: 'ADD_LONG',
            quantity: { mode: 'fixed_quote', value: 100, asset: 'USDT' },
          },
        ],
      }),
    ]))
    expect(ast.decisionPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          dcaSchedule: expect.objectContaining({ maxCount: 4 }),
        }),
      }),
    ]))
  })

  it('compiles reverse_position into close and open actions with AST metadata preserved', () => {
    const { ir, ast } = compileLifecycleMessage('跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。')

    const reverseMetadata = {
      fromSide: 'long',
      toSide: 'short',
      sameBarPolicy: 'allow',
      sizingSource: 'current_position',
    }

    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['positionLifecycle']))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          reversePosition: reverseMetadata,
        }),
        actions: [
          expect.objectContaining({ kind: 'CLOSE_LONG' }),
          expect.objectContaining({ kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } }),
        ],
      }),
    ]))
    expect(ast.decisionPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          reversePosition: reverseMetadata,
        }),
      }),
    ]))
  })
})
