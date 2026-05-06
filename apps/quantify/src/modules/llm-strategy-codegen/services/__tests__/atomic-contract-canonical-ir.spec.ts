import type { CanonicalStrategyIrV1, PredicateDef } from '../../types/canonical-strategy-ir'
import { buildLockedAtomicState } from './fixtures/semantic-state-golden-cases'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function compileAtomicState(name: Parameters<typeof buildLockedAtomicState>[0]): CanonicalStrategyIrV1 {
  const spec = new CanonicalSpecBuilderService().buildFromSemanticState(buildLockedAtomicState(name))
  return new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec: spec,
    fallback: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
      positionPct: 10,
    },
  }).ir
}

function findPredicate(
  ir: CanonicalStrategyIrV1,
  matcher: (predicate: PredicateDef) => boolean,
): PredicateDef {
  const predicate = ir.signalCatalog.predicates.find(matcher)
  expect(predicate).toBeDefined()
  return predicate as PredicateDef
}

describe('atomic contract canonical IR projection', () => {
  it('projects Bollinger lower touch and relative volume into an entry allOf predicate', () => {
    const ir = compileAtomicState('bollinger-volume-entry')

    const entryBlock = ir.ruleBlocks.find(block => block.phase === 'entry')
    expect(entryBlock).toBeDefined()
    const entryPredicate = findPredicate(ir, predicate => predicate.id === entryBlock?.when)

    expect(entryPredicate.kind).toBe('allOf')
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'compare', args: expect.arrayContaining([expect.stringContaining('lower_band')]) }),
      expect.objectContaining({ kind: 'compare', args: expect.arrayContaining([expect.stringContaining('sma_volume_20')]) }),
    ]))
    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['bollinger', 'smaVolume']))
  })

  it('projects breakout retest into sequence IR and remembers the breakout state key', () => {
    const ir = compileAtomicState('breakout-retest')

    const sequence = findPredicate(ir, predicate => predicate.kind === 'sequence')
    expect(sequence.params).toEqual(expect.objectContaining({
      sequenceKind: 'breakout_retest',
      memoryKey: 'breakout',
      lookbackWindow: '24h',
    }))
    expect(ir.runtimeRequirements?.stateKeys).toEqual(expect.arrayContaining(['breakout']))
  })

  it('projects ATR multiple risks into risk predicates and requires the atr helper', () => {
    const ir = compileAtomicState('atr-risk')

    expect(ir.riskPolicy.riskPredicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atrMultipleStop', params: expect.objectContaining({ multiple: 2 }) }),
      expect.objectContaining({ kind: 'atrMultipleTakeProfit', params: expect.objectContaining({ multiple: 3 }) }),
    ]))
    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['atr']))
  })

  it('projects logical any-of into generic anyOf without relying on atomic key allowlists', () => {
    const state = buildLockedAtomicState('atr-risk')
    state.triggers = [{
      id: 'entry-logical-any-of',
      key: 'logical.any_of',
      phase: 'entry',
      sideScope: 'long',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      params: {
        items: [
          {
            key: 'indicator.above',
            params: {
              indicator: 'ma',
              referenceRole: 'trend',
              'reference.period': 20,
            },
          },
          {
            key: 'indicator.below',
            params: {
              indicator: 'ma',
              referenceRole: 'trend',
              'reference.period': 50,
            },
          },
        ],
      },
    }]
    state.risk = []
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    }).ir

    const entryBlock = ir.ruleBlocks.find(block => block.phase === 'entry')
    expect(entryBlock).toBeDefined()
    const entryPredicate = findPredicate(ir, predicate => predicate.id === entryBlock?.when)
    expect(entryPredicate.kind).toBe('anyOf')
  })

  it('keeps attached gates in generic allOf when entry atomic predicates are combined with gates', () => {
    const state = buildLockedAtomicState('breakout-retest')
    state.triggers.push({
      id: 'gate-volume-relative-average',
      key: 'volume.relative_average',
      phase: 'gate',
      sideScope: 'long',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      params: {
        lookbackBars: 20,
        multiplier: 1.2,
        comparator: 'gt',
      },
    })
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    }).ir

    const entryBlock = ir.ruleBlocks.find(block => block.phase === 'entry')
    expect(entryBlock).toBeDefined()
    const entryPredicate = findPredicate(ir, predicate => predicate.id === entryBlock?.when)
    expect(entryPredicate.kind).toBe('allOf')
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sequence' }),
      expect.objectContaining({ kind: 'compare', args: expect.arrayContaining([expect.stringContaining('sma_volume_20')]) }),
    ]))
  })
})
