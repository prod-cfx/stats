import type { CanonicalStrategyIrV1, PredicateDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import type { SemanticState } from '../../types/semantic-state'
import { buildLockedAtomicState } from './fixtures/semantic-state-golden-cases'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

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

function lockedContextSlot(slotKey: string, fieldPath: string, value: string) {
  return {
    slotKey,
    fieldPath,
    value,
    status: 'locked' as const,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}

describe('atomic contract canonical IR projection', () => {
  it('keeps on-start entry as OPEN_LONG when add-position constraint evidence is present', () => {
    const slotEvidence = 'semantic.action.add_position.constraint: 最多加 1 次，最大总敞口 300 USDT。'
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      position: {
        mode: 'fixed_quote',
        value: 100,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'contextSlots.exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'contextSlots.symbol', 'ETHUSDT'),
        marketType: lockedContextSlot('marketType', 'contextSlots.marketType', 'spot'),
        timeframe: lockedContextSlot('timeframe', 'contextSlots.timeframe', '15m'),
      },
      normalizationNotes: [],
      updatedAt: '2026-05-19T00:00:00.000Z',
      rules: [
        {
          id: 'entry-dca-daily',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            key: 'execution.on_start',
            kind: 'atom',
            params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
            evidence: { text: slotEvidence },
          },
          effects: [{ key: 'action.open_long', kind: 'atom', params: {}, evidence: { text: slotEvidence } }],
        },
        {
          id: 'entry-dca-drawdown',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            key: 'price.percent_change',
            kind: 'atom',
            params: { basis: 'entry_avg_price', window: '1d', valuePct: 5, direction: 'down' },
            evidence: { text: slotEvidence },
          },
          effects: [{
            key: 'action.add_position',
            kind: 'atom',
            params: { addMode: 'drawdown_pct', sideScope: 'long', drawdownThreshold: 5 },
            evidence: { text: slotEvidence },
          }],
        },
        {
          id: 'clarified-position-pyramiding-limit',
          phase: 'gate',
          sideScope: 'both',
          condition: { key: 'position.pyramiding_limit', kind: 'atom', params: { maxLayers: 1 } },
          effects: [],
        },
      ] as SemanticState['rules'],
    }

    const projected = new SemanticRuleProjectionService().reprojectFromRules(state)
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected)

    expect(spec.rules.find(rule => rule.id === 'semantic-entry-1')?.actions).toEqual([
      expect.objectContaining({ type: 'OPEN_LONG', atomKey: 'action.open_long' }),
    ])
    expect(spec.rules.find(rule => rule.id === 'semantic-entry-2')?.actions).toEqual([
      expect.objectContaining({ type: 'ADD_LONG', atomKey: 'action.add_position' }),
    ])
  })

  it('projects Bollinger lower touch and relative volume into an entry allOf predicate', () => {
    const ir = compileAtomicState('bollinger-volume-entry')

    const entryBlock = ir.ruleBlocks.find(block => block.phase === 'entry')
    expect(entryBlock).toBeDefined()
    const entryPredicate = findPredicate(ir, predicate => predicate.id === entryBlock?.when)

    expect(entryPredicate.kind).toBe('allOf')
    // Issue #1460：touch confirmation 下 BOLL lower 走 LTE(LOW, lower_band)，不再是 compare(CLOSE, lower_band)
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'LTE',
        args: expect.arrayContaining([
          expect.stringContaining('low_'),
          expect.stringContaining('lower_band'),
        ]),
      }),
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

  it('compiles reclaim sequences into executable cross predicates with semantic params preserved', () => {
    const baseState = buildLockedAtomicState('breakout-retest')
    const state: SemanticState = {
      ...baseState,
      trigger: [{
        id: 'entry-rsi-reclaim',
        key: 'condition.sequence',
        phase: 'entry',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          sequenceKind: 'rsi_reclaim',
          threshold: 35,
        },
      }],
    }
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

    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'cross',
        args: expect.arrayContaining([expect.stringContaining('rsi_')]),
        params: expect.objectContaining({
          sequenceKind: 'rsi_reclaim',
          threshold: 35,
        }),
      }),
    ]))
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
    const baseState = buildLockedAtomicState('atr-risk')
    const state: SemanticState = {
      ...baseState,
      trigger: [{
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
      }],
      risk: [],
    }
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
    const baseState = buildLockedAtomicState('breakout-retest')
    const state: SemanticState = {
      ...baseState,
      trigger: [
        ...baseState.trigger,
        {
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
        },
      ],
    }
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

  it('projects locked external.signal entry into executable entry IR', () => {
    const baseState = buildLockedAtomicState('atr-risk')
    const state: SemanticState = {
      ...baseState,
      trigger: [{
        id: 'entry-webhook-whale',
        key: 'external.signal',
        phase: 'entry',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          provider: 'webhook',
          signalId: 'whale_buy',
          secret: 'configured',
        },
      }],
      action: [{
        id: 'open-long',
        key: 'action.open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      risk: [],
    }
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

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'external.signal',
          params: expect.objectContaining({ signalId: 'whale_buy' }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
    ]))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_LONG' })],
      }),
    ]))
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'externalSignal',
        params: expect.objectContaining({ signalId: 'whale_buy', sourceFeedId: 'webhook.whale_buy' }),
      }),
    ]))
  })

  it('keeps external.signal predicates collision-free when sanitized ids match', () => {
    const spec: CanonicalStrategySpecV2 = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '1h',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1h'],
      },
      rules: [
        {
          id: 'entry-signal-dash',
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'external.signal',
            params: { provider: 'webhook', signalId: 'foo-bar', secret: 'configured' },
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' } }],
        },
        {
          id: 'exit-signal-underscore',
          phase: 'exit',
          sideScope: 'long',
          priority: 90,
          condition: {
            kind: 'atom',
            key: 'external.signal',
            params: { provider: 'webhook', signalId: 'foo_bar', secret: 'configured' },
          },
          actions: [{ type: 'CLOSE_LONG' }],
        },
      ],
    }
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    }).ir

    const externalPredicates = ir.signalCatalog.predicates.filter(predicate => predicate.kind === 'externalSignal')
    expect(externalPredicates).toHaveLength(2)
    expect(new Set(externalPredicates.map(predicate => predicate.id)).size).toBe(2)
    expect(externalPredicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ params: expect.objectContaining({ signalId: 'foo-bar' }) }),
      expect.objectContaining({ params: expect.objectContaining({ signalId: 'foo_bar' }) }),
    ]))
  })
})
