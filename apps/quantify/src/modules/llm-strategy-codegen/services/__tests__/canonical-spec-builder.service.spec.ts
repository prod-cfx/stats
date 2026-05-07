import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2ValidatorService } from '../canonical-spec-v2-validator.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'
import type { SemanticAtomContract, SemanticExpression, SemanticExpressionOperator, SemanticPositionSizingContract, SemanticState } from '../../types/semantic-state'

type ExpectedCanonicalSizing = { mode: 'RATIO' | 'QUOTE' | 'QTY', value: number, asset?: string }

function closeOpenPredicate(op: SemanticExpressionOperator): SemanticExpression {
  return {
    kind: 'predicate',
    op,
    left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
    right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
  }
}

function createSemanticState(input: {
  triggers?: SemanticState['triggers']
  actions?: SemanticState['actions']
  risk?: SemanticState['risk']
  position?: SemanticState['position']
  positionMode?: string
}): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    contextSlots: {
      exchange: null,
      symbol: {
        slotKey: 'context.symbol',
        fieldPath: 'symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '交易标的',
        affectsExecution: true,
      },
      marketType: null,
      timeframe: {
        slotKey: 'context.timeframe',
        fieldPath: 'timeframe',
        value: '1m',
        status: 'locked',
        priority: 'context',
        questionHint: 'K 线周期',
        affectsExecution: true,
      },
    },
    position: input.position ?? {
      mode: 'fixed_quote',
      value: 10,
      positionMode: input.positionMode ?? 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    triggers: input.triggers ?? [],
    actions: input.actions ?? [],
    risk: input.risk ?? [],
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  }
}

function createLockedPositionWithSizing(sizing: SemanticPositionSizingContract): NonNullable<SemanticState['position']> {
  if (sizing.kind === 'ratio') {
    return {
      sizing,
      mode: 'fixed_ratio',
      value: sizing.value,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
  }

  if (sizing.kind === 'quote') {
    return {
      sizing,
      mode: 'fixed_quote',
      value: sizing.value,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
  }

  return {
    sizing,
    mode: 'fixed_qty',
    value: sizing.value,
    positionMode: 'long_only',
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

describe('canonicalSpecBuilderService', () => {
  it.each([
    [
      { kind: 'ratio', value: 0.1, unit: 'ratio' },
      { mode: 'RATIO', value: 0.1 },
    ],
    [
      { kind: 'quote', value: 10, asset: 'USDT' },
      { mode: 'QUOTE', value: 10, asset: 'USDT' },
    ],
    [
      { kind: 'base', value: 0.001, asset: 'BTC' },
      { mode: 'QTY', value: 0.001, asset: 'BTC' },
    ],
  ] satisfies Array<[SemanticPositionSizingContract, ExpectedCanonicalSizing]>)(
    'maps semantic position contract %o into canonical sizing %o',
    (semanticSizing, canonicalSizing) => {
      const service = new CanonicalSpecBuilderService()
      const state = createSemanticState({
        position: createLockedPositionWithSizing(semanticSizing),
      })

      const spec = service.buildFromSemanticState(state)

      expect(spec.sizing).toEqual(canonicalSizing)
    },
  )

  it('builds canonical spec from SemanticState expression', () => {
    const service = new CanonicalSpecBuilderService()
    const state: SemanticState = {
      version: 1,
      families: ['single-leg', 'state-gated'],
      contextSlots: {
        exchange: null,
        symbol: {
          slotKey: 'context.symbol',
          fieldPath: 'symbol',
          value: 'BTCUSDT',
          status: 'locked',
          priority: 'context',
          questionHint: '交易标的',
          affectsExecution: true,
        },
        marketType: null,
        timeframe: {
          slotKey: 'context.timeframe',
          fieldPath: 'timeframe',
          value: '1m',
          status: 'locked',
          priority: 'context',
          questionHint: 'K 线周期',
          affectsExecution: true,
        },
      },
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      triggers: [
        {
          id: 'entry-close-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
              right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
            },
          },
        },
        {
          id: 'gate-no-position',
          key: 'condition.expression',
          phase: 'gate',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
        },
        {
          id: 'exit-close-open',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
              right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
            },
          },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      normalizationNotes: [],
      updatedAt: '2026-04-28T00:00:00.000Z',
    }

    const spec = service.buildFromSemanticState(state)

    expect(spec.market).toEqual({
      exchange: null,
      symbol: 'BTCUSDT',
      marketType: null,
      defaultTimeframe: '1m',
    })
    expect(spec.sizing).toEqual({ mode: 'QUOTE', value: 10, asset: 'USDT' })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic-entry-1',
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          kind: 'expression',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
        }),
        actions: [expect.objectContaining({
          type: 'OPEN_LONG',
          sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' },
        })],
      }),
      expect.objectContaining({
        id: 'semantic-exit-1',
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          kind: 'expression',
          op: 'LT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        phase: 'gate',
        sideScope: 'long',
        condition: expect.objectContaining({
          kind: 'atom',
          key: 'position.has_position',
          op: 'EQ',
          value: false,
        }),
        actions: [expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' })],
      }),
    ]))
    expect(new CanonicalSpecV2ValidatorService().validate(spec)).toEqual(expect.objectContaining({
      status: 'VALID',
    }))
  })

  it('keeps independent same-side entry triggers as separate rule blocks', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'entry-close-above-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('GT') },
        },
        {
          id: 'entry-close-below-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('LT') },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
    })

    const spec = service.buildFromSemanticState(state)
    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

    expect(entryRules).toHaveLength(2)
    expect(entryRules.map(rule => rule.condition)).toEqual([
      expect.objectContaining({ kind: 'expression', op: 'GT' }),
      expect.objectContaining({ kind: 'expression', op: 'LT' }),
    ])
    expect(entryRules).not.toContainEqual(expect.objectContaining({
      condition: expect.objectContaining({ kind: 'AND' }),
    }))
  })

  it('does not build trading rules from locked triggers without matching locked actions', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'entry-close-above-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('GT') },
        },
        {
          id: 'exit-close-below-open',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('LT') },
        },
      ],
      actions: [],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules.filter(rule => rule.phase === 'entry' || rule.phase === 'exit')).toEqual([])
  })

  describe('semantic trigger contract rule groups', () => {
    const service = new CanonicalSpecBuilderService()

    it('compiles EMA20/60/144 explicit AND entry group into one OPEN_LONG rule', () => {
      const state = createSemanticState({
        triggers: [20, 60, 144].map(period => ({
          id: `entry-ema${period}`,
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { indicator: 'ema', 'reference.period': period },
          contracts: [{
            id: 'contract-entry-ema-stack',
            kind: 'trigger',
            capabilities: [],
            requires: [],
            params: {
              groupId: 'entry-ema-stack',
              join: 'AND',
              actionKey: 'open_long',
              actionBinding: 'single_action',
            },
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        })),
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

      expect(entryRules).toHaveLength(1)
      expect(entryRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'AND' }))
      expect(entryRules[0]?.actions).toEqual([expect.objectContaining({ type: 'OPEN_LONG' })])
    })

    it('compiles MA100 below OR MACD death cross explicit OR exit group into one CLOSE_LONG rule', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'exit-ma100',
            key: 'indicator.below',
            phase: 'exit',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { indicator: 'ma', 'reference.period': 100 },
            contracts: [{
              id: 'contract-exit-ma100-macd',
              kind: 'trigger',
              capabilities: [],
              requires: [],
              params: {
                groupId: 'exit-ma100-macd',
                join: 'OR',
                actionKey: 'close_long',
                actionBinding: 'single_action',
              },
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
          {
            id: 'exit-macd-death',
            key: 'indicator.cross_under',
            phase: 'exit',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { indicator: 'macd' },
            contracts: [{
              id: 'contract-exit-ma100-macd',
              kind: 'trigger',
              capabilities: [],
              requires: [],
              params: {
                groupId: 'exit-ma100-macd',
                join: 'OR',
                actionKey: 'close_long',
                actionBinding: 'single_action',
              },
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
        ],
        actions: [
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

      expect(exitRules).toHaveLength(1)
      expect(exitRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'OR' }))
      expect(exitRules[0]?.actions).toEqual([expect.objectContaining({ type: 'CLOSE_LONG' })])
    })

    it('attaches gate triggers to entry groups without creating an extra open rule', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'gate-close-above-open',
            key: 'condition.expression',
            phase: 'gate',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { expression: closeOpenPredicate('GT') },
          },
          {
            id: 'entry-rsi-cross',
            key: 'indicator.cross_over',
            phase: 'entry',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { indicator: 'rsi', value: 50 },
            contracts: [{
              id: 'contract-entry-rsi',
              kind: 'trigger',
              capabilities: [],
              requires: [],
              params: {
                groupId: 'entry-rsi',
                join: 'AND',
                actionKey: 'open_long',
                actionBinding: 'single_action',
              },
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
        ],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const openRules = spec.rules.filter(rule => rule.actions.some(action => action.type === 'OPEN_LONG'))

      expect(openRules).toHaveLength(1)
      expect(openRules[0]?.condition).toEqual(expect.objectContaining({
        kind: 'AND',
        children: expect.arrayContaining([
          expect.objectContaining({ key: 'rsi.cross_over' }),
          expect.objectContaining({ kind: 'expression', op: 'GT' }),
        ]),
      }))
      expect(spec.rules.filter(rule => rule.phase === 'gate')).toHaveLength(0)
    })

    it('keeps ungrouped simple entry and exit triggers as singleton rules', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'entry-close-above-open',
            key: 'condition.expression',
            phase: 'entry',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { expression: closeOpenPredicate('GT') },
          },
          {
            id: 'exit-close-below-open',
            key: 'condition.expression',
            phase: 'exit',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { expression: closeOpenPredicate('LT') },
          },
        ],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
      const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

      expect(entryRules).toHaveLength(1)
      expect(exitRules).toHaveLength(1)
      expect(entryRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'expression', op: 'GT' }))
      expect(entryRules[0]?.actions).toEqual([expect.objectContaining({ type: 'OPEN_LONG' })])
      expect(exitRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'expression', op: 'LT' }))
      expect(exitRules[0]?.actions).toEqual([expect.objectContaining({ type: 'CLOSE_LONG' })])
    })

    it('does not default execution.on_start actions inside mixed trigger groups', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'entry-on-start',
            key: 'execution.on_start',
            phase: 'entry',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: {},
            contracts: [{
              id: 'contract-entry-on-start-with-filter',
              kind: 'trigger',
              capabilities: [],
              requires: [],
              params: {
                groupId: 'entry-on-start-with-filter',
                join: 'AND',
                actionKey: 'open_long',
                actionBinding: 'single_action',
              },
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
          {
            id: 'entry-filter',
            key: 'condition.expression',
            phase: 'entry',
            sideScope: 'long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { expression: closeOpenPredicate('GT') },
            contracts: [{
              id: 'contract-entry-on-start-with-filter',
              kind: 'trigger',
              capabilities: [],
              requires: [],
              params: {
                groupId: 'entry-on-start-with-filter',
                join: 'AND',
                actionKey: 'open_long',
                actionBinding: 'single_action',
              },
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
        ],
        actions: [],
      })

      const spec = service.buildFromSemanticState(state)

      expect(spec.rules.filter(rule => rule.phase === 'entry')).toEqual([])
    })

    it('keeps ungrouped simple both-side exit as one rule with aggregated close actions', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'exit-close-below-open-both',
            key: 'condition.expression',
            phase: 'exit',
            sideScope: 'both',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: { expression: closeOpenPredicate('LT') },
          },
        ],
        actions: [
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

      expect(exitRules).toHaveLength(1)
      expect(exitRules[0]).toEqual(expect.objectContaining({
        sideScope: 'both',
        condition: expect.objectContaining({ kind: 'expression', op: 'LT' }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'CLOSE_LONG' }),
          expect.objectContaining({ type: 'CLOSE_SHORT' }),
        ]),
      }))
    })

    it('keeps legacy grouped both-side entry split into long and short rules when actionKey is implicit', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'entry-legacy-both-fast',
            key: 'indicator.above',
            phase: 'entry',
            sideScope: 'both',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: {
              groupId: 'legacy-entry-both',
              join: 'AND',
              indicator: 'ema',
              'reference.period': 20,
            },
          },
          {
            id: 'entry-legacy-both-slow',
            key: 'indicator.above',
            phase: 'entry',
            sideScope: 'both',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: {
              groupId: 'legacy-entry-both',
              join: 'AND',
              indicator: 'ema',
              'reference.period': 60,
            },
          },
        ],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

      expect(entryRules).toHaveLength(2)
      expect(entryRules).toEqual([
        expect.objectContaining({
          sideScope: 'long',
          condition: expect.objectContaining({ kind: 'AND' }),
          actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
        }),
        expect.objectContaining({
          sideScope: 'short',
          condition: expect.objectContaining({ kind: 'AND' }),
          actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
        }),
      ])
    })

    it('keeps legacy grouped both-side exit as one rule with aggregated close actions when actionKey is implicit', () => {
      const state = createSemanticState({
        triggers: [
          {
            id: 'exit-legacy-both-ma',
            key: 'indicator.below',
            phase: 'exit',
            sideScope: 'both',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: {
              groupId: 'legacy-exit-both',
              join: 'OR',
              indicator: 'ma',
              'reference.period': 100,
            },
          },
          {
            id: 'exit-legacy-both-macd',
            key: 'indicator.cross_under',
            phase: 'exit',
            sideScope: 'both',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            params: {
              groupId: 'legacy-exit-both',
              join: 'OR',
              indicator: 'macd',
            },
          },
        ],
        actions: [
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
        ],
      })

      const spec = service.buildFromSemanticState(state)
      const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

      expect(exitRules).toHaveLength(1)
      expect(exitRules[0]).toEqual(expect.objectContaining({
        sideScope: 'both',
        condition: expect.objectContaining({ kind: 'OR' }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'CLOSE_LONG' }),
          expect.objectContaining({ type: 'CLOSE_SHORT' }),
        ]),
      }))
    })
  })

  it('projects contract order programs from SemanticState without grid signal actions', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'contract-price-levels',
          key: 'contract.price_levels',
          phase: 'entry',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {},
          contracts: [{
            id: 'contract-price-levels',
            kind: 'trigger' as const,
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: {
                lower: 60000,
                upper: 80000,
                gridIntervals: 10,
                gridCount: 11,
                absoluteSpacing: 2000,
                spacingMode: 'arithmetic',
              },
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
      ],
      actions: [
        {
          id: 'contract-limit-ladder',
          key: 'contract.limit_ladder',
          status: 'locked',
          source: 'user_explicit',
          contracts: [{
            id: 'contract-limit-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: {
                orderType: 'limit',
                timeInForce: 'gtc',
                recycleOnFill: true,
              },
            }],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
              { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
              { domain: 'exposure', verb: 'set', object: 'position_mode' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
      ],
      risk: [{
        id: 'contract-exposure',
        key: 'contract.exposure',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {},
        contracts: [{
          id: 'contract-exposure',
          kind: 'risk',
          capabilities: [{
            domain: 'exposure',
            verb: 'set',
            object: 'position_mode',
            shape: { mode: 'neutral' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      position: {
        mode: 'fixed_quote',
        value: 20,
        positionMode: 'neutral',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        sizing: { kind: 'quote', value: 20, asset: 'USDT' },
        contracts: [{
          id: 'contract-capital',
          kind: 'position',
          capabilities: [{
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 20, asset: 'USDT' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      },
    })
    state.contextSlots.exchange = {
      slotKey: 'context.exchange',
      fieldPath: 'exchange',
      value: 'okx',
      status: 'locked',
      priority: 'context',
      questionHint: '交易所',
      affectsExecution: true,
    }
    state.contextSlots.symbol = {
      slotKey: 'context.symbol',
      fieldPath: 'symbol',
      value: 'BTC-USDT-SWAP',
      status: 'locked',
      priority: 'context',
      questionHint: '交易标的',
      affectsExecution: true,
    }
    state.contextSlots.marketType = {
      slotKey: 'context.marketType',
      fieldPath: 'marketType',
      value: 'perp',
      status: 'locked',
      priority: 'context',
      questionHint: '市场类型',
      affectsExecution: true,
    }
    state.contextSlots.timeframe = {
      slotKey: 'context.timeframe',
      fieldPath: 'timeframe',
      value: '15m',
      status: 'locked',
      priority: 'context',
      questionHint: 'K 线周期',
      affectsExecution: true,
    }

    const canonicalSpec = service.buildFromSemanticState(state)

    expect(canonicalSpec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(canonicalSpec.orderPrograms).toEqual([
      expect.objectContaining({
        kind: 'contract_order_program',
        mode: 'perp_neutral',
        orderType: 'limit',
        timeInForce: 'gtc',
      }),
    ])
    expect(canonicalSpec.orderPrograms[0]).toEqual(expect.objectContaining({
      levelSet: {
        lower: 60000,
        upper: 80000,
        gridIntervals: 10,
        gridCount: 11,
        absoluteSpacing: 2000,
        spacingMode: 'arithmetic',
      },
      budget: {
        mode: 'per_order_quote',
        value: 20,
        asset: 'USDT',
      },
      recycleOnFill: true,
      cancelOnStop: true,
    }))
    expect(canonicalSpec.rules.flatMap(rule => rule.actions.map(action => action.type))).not.toContain('OPEN_LONG')
    expect(canonicalSpec.rules.flatMap(rule => rule.actions.map(action => action.type))).not.toContain('CLOSE_LONG')
  })

  it('projects centered-percent contract order programs without requiring numeric bounds', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'contract-centered-price-levels',
          key: 'contract.price_levels.centered',
          phase: 'entry',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {},
          contracts: [{
            id: 'contract-centered-price-levels',
            kind: 'trigger',
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: {
                mode: 'centered_percent_range',
                centerTiming: 'deployment',
                centerSource: 'last_price',
                totalRangePct: 0.8,
                gridIntervals: 10,
                gridCount: 11,
                spacingMode: 'arithmetic',
              },
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
      ],
      actions: [
        {
          id: 'contract-limit-ladder',
          key: 'contract.limit_ladder',
          status: 'locked',
          source: 'user_explicit',
          contracts: [{
            id: 'contract-limit-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: {
                orderType: 'limit',
                timeInForce: 'gtc',
                recycleOnFill: true,
                cancelOnStop: true,
              },
            }],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
              { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
      ],
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
        contracts: [{
          id: 'contract-capital',
          kind: 'position',
          capabilities: [{
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 10, asset: 'USDT' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      },
    })
    state.contextSlots.exchange = {
      slotKey: 'context.exchange',
      fieldPath: 'exchange',
      value: 'okx',
      status: 'locked',
      priority: 'context',
      questionHint: '交易所',
      affectsExecution: true,
    }
    state.contextSlots.symbol = {
      slotKey: 'context.symbol',
      fieldPath: 'symbol',
      value: 'ETHUSDT',
      status: 'locked',
      priority: 'context',
      questionHint: '交易标的',
      affectsExecution: true,
    }
    state.contextSlots.marketType = {
      slotKey: 'context.marketType',
      fieldPath: 'marketType',
      value: 'spot',
      status: 'locked',
      priority: 'context',
      questionHint: '市场类型',
      affectsExecution: true,
    }

    const canonicalSpec = service.buildFromSemanticState(state)

    expect(canonicalSpec.orderPrograms).toHaveLength(1)
    expect(canonicalSpec.orderPrograms[0]).toEqual(expect.objectContaining({
      kind: 'contract_order_program',
      mode: 'spot',
      levelSet: {
        mode: 'centered_percent_range',
        centerTiming: 'deployment',
        centerSource: 'last_price',
        halfRangePct: 0.4,
        gridIntervals: 10,
        gridCount: 11,
        spacingMode: 'arithmetic',
      },
      budget: {
        mode: 'per_order_quote',
        value: 10,
        asset: 'USDT',
      },
      orderType: 'limit',
      recycleOnFill: true,
      cancelOnStop: true,
    }))
  })

  it.each([
    [
      'original order',
      [
        { lower: 60000, upper: 80000, gridCount: 100, spacingMode: 'arithmetic' },
        { lower: 61000, upper: 79000, gridCount: 100, spacingMode: 'arithmetic' },
      ],
    ],
    [
      'reversed order',
      [
        { lower: 61000, upper: 79000, gridCount: 100, spacingMode: 'arithmetic' },
        { lower: 60000, upper: 80000, gridCount: 100, spacingMode: 'arithmetic' },
      ],
    ],
    [
      'different absolute spacing',
      [
        { lower: 60000, upper: 80000, gridCount: 11, absoluteSpacing: 2000, spacingMode: 'arithmetic' },
        { lower: 60000, upper: 80000, gridCount: 11, absoluteSpacing: 2500, spacingMode: 'arithmetic' },
      ],
    ],
  ])('rejects conflicting duplicate contract order programs level sets in %s', (_, levelSetShapes) => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'contract-price-levels',
          key: 'contract.price_levels',
          phase: 'entry',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {},
          contracts: levelSetShapes.map((shape, index): SemanticAtomContract => ({
            id: `contract-price-levels-${index + 1}`,
            kind: 'trigger',
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape,
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          })),
        },
      ],
      actions: [
        {
          id: 'contract-limit-ladder',
          key: 'contract.limit_ladder',
          status: 'locked',
          source: 'user_explicit',
          contracts: [{
            id: 'contract-limit-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: {
                orderType: 'limit',
                timeInForce: 'gtc',
                recycleOnFill: true,
              },
            }],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
              { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
              { domain: 'exposure', verb: 'set', object: 'position_mode' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
      ],
      risk: [{
        id: 'contract-exposure',
        key: 'contract.exposure',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {},
        contracts: [{
          id: 'contract-exposure',
          kind: 'risk',
          capabilities: [{
            domain: 'exposure',
            verb: 'set',
            object: 'position_mode',
            shape: { mode: 'neutral' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      position: {
        mode: 'fixed_quote',
        value: 20,
        positionMode: 'neutral',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        sizing: { kind: 'quote', value: 20, asset: 'USDT' },
        contracts: [{
          id: 'contract-capital',
          kind: 'position',
          capabilities: [{
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 20, asset: 'USDT' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      },
    })
    state.contextSlots.marketType = {
      slotKey: 'context.marketType',
      fieldPath: 'marketType',
      value: 'perp',
      status: 'locked',
      priority: 'context',
      questionHint: '市场类型',
      affectsExecution: true,
    }

    const canonicalSpec = service.buildFromSemanticState(state)

    expect(canonicalSpec.orderPrograms).toEqual([])
  })

  it('attaches generic semantic gates to entry rules without blocking exits', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'entry-close-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('GT') },
        },
        {
          id: 'exit-close-open',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { expression: closeOpenPredicate('LT') },
        },
        {
          id: 'regime-gate',
          key: 'market.regime',
          phase: 'gate',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { value: 'range', mode: 'hard_gate' },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
    })

    const spec = service.buildFromSemanticState(state)
    const entryRule = spec.rules.find(rule => rule.phase === 'entry')
    const exitRule = spec.rules.find(rule => rule.phase === 'exit')

    expect(entryRule?.condition).toEqual(expect.objectContaining({
      kind: 'AND',
      children: expect.arrayContaining([
        expect.objectContaining({ kind: 'expression', op: 'GT' }),
        expect.objectContaining({ key: 'market.regime', value: 'range' }),
      ]),
    }))
    expect(exitRule?.condition).toEqual(expect.objectContaining({
      kind: 'expression',
      op: 'LT',
    }))
    expect(JSON.stringify(exitRule?.condition)).not.toContain('market.regime')
  })

  it('builds valid SemanticState entry rules when sideScope both opens long and short', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      positionMode: 'long_short',
      triggers: [
        {
          id: 'entry-both-close-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'both',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            expression: closeOpenPredicate('GT'),
          },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
      ],
    })

    const spec = service.buildFromSemanticState(state)
    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

    expect(entryRules).toEqual([
      expect.objectContaining({
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
    ])
    expect(entryRules).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'OPEN_LONG' }),
          expect.objectContaining({ type: 'OPEN_SHORT' }),
        ]),
      }),
    ]))
    expect(new CanonicalSpecV2ValidatorService().validate(spec)).toEqual(expect.objectContaining({
      status: 'VALID',
    }))
  })

  it('builds SemanticState canonical risk rules from locked stop loss and take profit', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'stop-loss',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'take-profit',
          key: 'risk.take_profit_pct',
          params: { valuePct: 10 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'long',
        condition: expect.objectContaining({
          kind: 'atom',
          key: 'position_loss_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: 0.05,
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'long',
        condition: expect.objectContaining({
          kind: 'atom',
          key: 'risk.take_profit_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: 0.1,
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
    expect(new CanonicalSpecV2ValidatorService().validate(spec)).toEqual(expect.objectContaining({
      status: 'VALID',
    }))
  })

  it('keeps both-side ATR take-profit actions faithful to long and short position contracts', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      positionMode: 'long_short',
      risk: [
        {
          id: 'atr-take-profit',
          key: 'risk.atr_multiple_take_profit',
          params: { multiple: 3 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)
    const riskRule = spec.rules.find(rule => rule.id === 'semantic-atr-take-profit')

    expect(riskRule).toEqual(expect.objectContaining({
      phase: 'risk',
      sideScope: 'both',
      condition: expect.objectContaining({
        key: 'risk.atr_multiple_take_profit',
        params: { multiple: 3 },
      }),
      actions: [
        expect.objectContaining({ type: 'CLOSE_LONG' }),
        expect.objectContaining({ type: 'CLOSE_SHORT' }),
      ],
    }))
  })

  it('projects normalized semantic risk basis to legacy riskRules compatibility output', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'risk-1',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).toContainEqual(expect.objectContaining({
      phase: 'risk',
      condition: expect.objectContaining({
        kind: 'atom',
        key: 'position_loss_pct',
        params: { basis: 'entry_avg_price' },
      }),
    }))
  })

  it('builds SemanticState canonical risk expression rules', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'daily-loss-halt',
          key: 'risk.condition_expression',
          params: {
            condition: {
              kind: 'predicate',
              op: 'LTE',
              left: { kind: 'position', field: 'pnl_pct' },
              right: { kind: 'constant', value: -5, unit: 'percent' },
            },
            effect: { type: 'pause_strategy' },
            scope: 'strategy',
            capabilityStatus: 'supported',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).toContainEqual(expect.objectContaining({
      id: 'semantic-daily-loss-halt',
      phase: 'risk',
      condition: expect.objectContaining({ kind: 'expression', op: 'LTE' }),
      actions: [expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' })],
      metadata: expect.objectContaining({
        semanticKey: 'risk.condition_expression',
        capabilityStatus: 'supported',
      }),
    }))
    expect(new CanonicalSpecV2ValidatorService().validate(spec)).toEqual(expect.objectContaining({
      status: 'VALID',
    }))
  })

  it('does not build executable rules for recognized unsupported risk expressions', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'daily-loss-halt',
          key: 'risk.condition_expression',
          params: {
            condition: {
              kind: 'predicate',
              op: 'LTE',
              left: { kind: 'position', field: 'pnl_pct' },
              right: { kind: 'constant', value: -5, unit: 'percent' },
            },
            effect: { type: 'pause_strategy' },
            scope: 'strategy',
            capabilityStatus: 'recognized_unsupported',
            unsupportedReason: 'risk_expression_compiler_not_available',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic-daily-loss-halt',
      }),
    ]))
  })

  it('uses risk expression scope when building side-specific risk rules', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'short-loss-close',
          key: 'risk.condition_expression',
          params: {
            condition: {
              kind: 'predicate',
              op: 'LTE',
              left: { kind: 'position', field: 'pnl_pct', side: 'short' },
              right: { kind: 'constant', value: -3, unit: 'percent' },
            },
            effect: { type: 'close_position' },
            scope: 'short',
            capabilityStatus: 'supported',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).toContainEqual(expect.objectContaining({
      id: 'semantic-short-loss-close',
      sideScope: 'short',
      actions: [{ type: 'FORCE_EXIT' }],
    }))
  })

  it('builds supported risk expressions from normalized intent', () => {
    const service = new CanonicalSpecBuilderService()
    const spec = service.buildFromNormalizedIntent({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    } as any, {
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [{
        key: 'risk.condition_expression',
        params: {
          condition: {
            kind: 'predicate',
            op: 'LTE',
            left: { kind: 'position', field: 'pnl_pct' },
            right: { kind: 'constant', value: -4, unit: 'percent' },
          },
          effect: { type: 'close_position' },
          scope: 'current_position',
          capabilityStatus: 'supported',
        },
      }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
      unresolved: [],
      normalizationNotes: [],
    } as any)

    expect(spec.rules).toContainEqual(expect.objectContaining({
      id: 'risk-condition-expression',
      phase: 'risk',
      condition: expect.objectContaining({ kind: 'expression', op: 'LTE' }),
      actions: [{ type: 'FORCE_EXIT' }],
    }))
  })

  it('keeps non-executable non-default risk basis out of SemanticState canonical risk rules', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      risk: [
        {
          id: 'peak-stop',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5, basis: 'peak_position_pnl', basisSource: 'user_explicit' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).not.toContainEqual(expect.objectContaining({
      phase: 'risk',
      condition: expect.objectContaining({
        key: 'position_loss_pct',
      }),
    }))
  })

  it('builds SemanticState canonical condition groups from logical expressions', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        {
          id: 'entry-logical-close-open',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            expression: {
              kind: 'AND',
              children: [
                closeOpenPredicate('GT'),
                {
                  kind: 'predicate',
                  op: 'LT',
                  left: { kind: 'series', source: 'bar', field: 'low', offsetBars: 0 },
                  right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
                },
              ],
            },
          },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
    })

    const spec = service.buildFromSemanticState(state)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic-entry-1',
        condition: {
          kind: 'AND',
          children: [
            expect.objectContaining({ kind: 'expression', op: 'GT' }),
            expect.objectContaining({ kind: 'expression', op: 'LT' }),
          ],
        },
      }),
    ]))
  })

  it('bridges StrategyIR back into canonical spec v2 through the migration entry point', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromStrategyIr({
      version: 'strategy-ir.v1',
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      intent: {
        kind: 'grid.range_rebalance',
        trigger: {
          range: { lower: 60000, upper: 80000 },
          stepPct: 0.5,
          sideMode: 'bidirectional',
          recycle: true,
        },
        sizing: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_short',
        },
        actions: ['open_long', 'close_long', 'open_short', 'close_short'],
        risk: [
          {
            kind: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price' },
          },
        ],
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
    ]))
  })

  it('builds stable sma crossover rules from normalized intent through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const normalizedIntent = new StrategyIntentNormalizerService().normalize({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
      },
    } as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
      },
    } as any, normalizedIntent)

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '1h',
    })
    expect(spec.indicators).toEqual([
      { kind: 'ema', params: { fastPeriod: 7, slowPeriod: 21 } },
    ])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.golden_cross',
          op: 'CROSS_OVER',
          params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            source: 'normalized-intent',
            family: 'single-leg',
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.death_cross',
          op: 'CROSS_UNDER',
          params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'position_loss_pct',
          value: 0.05,
          params: { basis: 'entry_avg_price' },
        }),
      }),
    ]))
    expect(spec.metadata).toEqual(expect.objectContaining({
      normalized: expect.objectContaining({
        source: 'normalized-intent',
      }),
    }))
  })

  it('builds canonical spec directly from normalized semantic intent without compatibility checklist projection', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '15m' },
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_upper',
          phase: 'entry',
          sideScope: 'short',
          params: { period: 20, stdDev: 2, confirmationMode: 'touch' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_short' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: null,
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'bollinger.upper_break',
          op: 'GTE',
          params: { confirmationMode: 'touch' },
        }),
      }),
    ]))
  })

  it('preserves per-trigger timeframes for multi-timeframe indicator compare triggers', () => {
    const service = new CanonicalSpecBuilderService()
    const normalizedIntent = {
      families: ['single-leg'],
      triggers: ['15m', '1h', '4h'].map(timeframe => ({
        key: 'indicator.above',
        phase: 'entry',
        closureStatus: 'closed',
        unresolvedSlots: [],
        params: {
          indicator: 'ema',
          referenceRole: 'long_term',
          'reference.period': 20,
          timeframe,
        },
      })),
      actions: [{ key: 'open_long' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    } as any, normalizedIntent as any)
    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]?.condition).toEqual(expect.objectContaining({
      kind: 'AND',
      children: [
        expect.objectContaining({ params: expect.objectContaining({ timeframe: '15m' }) }),
        expect.objectContaining({ params: expect.objectContaining({ timeframe: '1h' }) }),
        expect.objectContaining({ params: expect.objectContaining({ timeframe: '4h' }) }),
      ],
    }))
    expect(spec.market.timeframes).toEqual(expect.arrayContaining(['15m', '1h', '4h']))
  })

  it('builds one semantic entry rule when one entry condition requires multiple timeframes', () => {
    const service = new CanonicalSpecBuilderService()
    const state = createSemanticState({
      triggers: [
        ...['5m', '1h', '4h'].map((timeframe, index) => ({
          id: `entry-ema-${index}`,
          key: 'indicator.above',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          params: {
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 20,
            timeframe,
          },
        })),
        {
          id: 'exit-ema-15m',
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 20,
            timeframe: '15m',
          },
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
    })
    state.contextSlots.exchange = {
      slotKey: 'context.exchange',
      fieldPath: 'exchange',
      value: 'binance',
      status: 'locked',
      priority: 'context',
      questionHint: '交易所',
      affectsExecution: true,
    }
    state.contextSlots.marketType = {
      slotKey: 'context.marketType',
      fieldPath: 'marketType',
      value: 'perp',
      status: 'locked',
      priority: 'context',
      questionHint: '市场类型',
      affectsExecution: true,
    }
    state.contextSlots.timeframe = {
      slotKey: 'context.timeframe',
      fieldPath: 'timeframe',
      value: '15m',
      status: 'locked',
      priority: 'context',
      questionHint: 'K 线周期',
      affectsExecution: true,
    }

    const spec = service.buildFromSemanticState(state)
    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
    const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]).toEqual(expect.objectContaining({
      actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      condition: expect.objectContaining({
        kind: 'AND',
        children: [
          expect.objectContaining({ key: 'indicator.above', params: expect.objectContaining({ timeframe: '5m' }) }),
          expect.objectContaining({ key: 'indicator.above', params: expect.objectContaining({ timeframe: '1h' }) }),
          expect.objectContaining({ key: 'indicator.above', params: expect.objectContaining({ timeframe: '4h' }) }),
        ],
      }),
    }))
    expect(exitRules).toHaveLength(1)
    expect(exitRules[0]?.condition).toEqual(expect.objectContaining({
      key: 'indicator.below',
      params: expect.objectContaining({ timeframe: '15m' }),
    }))
    expect(spec.dataRequirements.requiredTimeframes).toEqual(expect.arrayContaining(['15m', '5m', '1h', '4h']))
  })

  it('does not treat a bare asset symbol as a canonical market symbol', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTC'],
      timeframes: ['1h'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
      },
    })

    expect(spec.market.symbol).toBeNull()
  })

  it('builds canonical spec from generic execution triggers without falling back to compatibility placeholders', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'spot', defaultTimeframe: '1h' },
      symbols: ['ORDIUSDT'],
      timeframes: ['1h'],
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'execution.on_start',
          phase: 'entry',
          sideScope: 'long',
          params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: { valuePct: 1, basis: 'prev_close', window: '1h' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'execution.on_start',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'GTE',
          value: 0.01,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('preserves price-vs-single-ma breakout semantics for indicator.above/below normalized triggers', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '1h' },
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 50 },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'indicator.below',
          phase: 'exit',
          params: { indicator: 'ma', referenceRole: 'short_term', 'reference.period': 20 },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'indicator.above',
          op: 'GTE',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'indicator.below',
          op: 'LTE',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
          }),
        }),
      }),
    ]))
  })

  it('normalizes single-trade sizing language into semantic position sizing', () => {
    const extractor = new SemanticSeedExtractorService()

    const semanticPatch = extractor.extract(
      '在 OKX 现货市场交易 BTCUSDT，单笔使用 10% 资金',
    )

    expect(semanticPatch.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.1,
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      positionMode: 'long_only',
      contracts: expect.arrayContaining([
        expect.objectContaining({
          kind: 'position',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'capital',
              verb: 'allocate',
              object: 'position_sizing',
            }),
          ]),
        }),
      ]),
    }))
  })

  it('fills default entry-price basis for stop-loss and take-profit when checklist omits them', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['15 分钟上涨 1% 买入'],
      exitRules: ['15 分钟下跌 5% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        takeProfitPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    ]))
  })

  it('preserves executable clarified stop-loss basis and compiles position-pnl take-profit as an expression', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘价突破上轨时做空'],
      exitRules: ['价格回到中轨（20日均线）时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    ]))
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-take-profit',
        condition: expect.objectContaining({
          kind: 'expression',
          op: 'GTE',
          left: { kind: 'position', field: 'pnl_pct' },
          right: { kind: 'constant', value: 10, unit: 'percent' },
        }),
        metadata: expect.objectContaining({ basis: 'position_pnl' }),
      }),
    ]))
  })

  it('emits canonical default timeframe and per-rule timeframe params for multi-timeframe strategies', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      entryRuleDrafts: [{ id: 'entry-1', phase: 'entry', text: '3m 内下跌 1% 买入', timeframe: '3m' }],
      exitRuleDrafts: [{ id: 'exit-1', phase: 'exit', text: '15m 内上涨 2% 卖出', timeframe: '15m', basis: 'entry_avg_price' }],
      riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10, stopLossPct: 5 },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '3m',
    })
    expect(spec.dataRequirements.requiredTimeframes).toEqual(['3m', '15m'])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-price-change-1',
        condition: expect.objectContaining({
          params: expect.objectContaining({ timeframe: '3m' }),
        }),
      }),
      expect.objectContaining({
        id: 'exit-price-change-1',
        condition: expect.objectContaining({
          params: expect.objectContaining({ timeframe: '15m' }),
        }),
      }),
    ]))
  })

  it('builds explicit position-pnl risk rules as canonical expressions', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['15 分钟上涨 1% 买入'],
      exitRules: ['15 分钟下跌 5% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'position_pnl',
        takeProfitPct: 10,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
        condition: expect.objectContaining({
          kind: 'expression',
          op: 'LTE',
          left: { kind: 'position', field: 'pnl_pct' },
          right: { kind: 'constant', value: -5, unit: 'percent' },
        }),
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        phase: 'risk',
        condition: expect.objectContaining({
          kind: 'expression',
          op: 'GTE',
          left: { kind: 'position', field: 'pnl_pct' },
          right: { kind: 'constant', value: 10, unit: 'percent' },
        }),
      }),
    ]))
  })

  it('does not inject sma when clarified bollinger middle-band semantics use a moving-average alias', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘价突破上轨时做空'],
      exitRules: ['价格回到中轨（20日均线）时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        positionPct: 10,
      },
    })

    expect(spec.indicators).toEqual([
      expect.objectContaining({ kind: 'bollingerBands' }),
    ])
    expect(spec.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
  })

  it('builds independent Bollinger rules for upper-short, lower-long, middle-close, and outside-band full close', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前全平',
        positionPct: 10,
      },
    })

    expect(spec.version).toBe(2)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'both',
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'CLOSE_LONG' }),
          expect.objectContaining({ type: 'CLOSE_SHORT' }),
        ]),
      }),
      expect.objectContaining({
        phase: 'risk',
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))

    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
    expect(entryRules).toHaveLength(2)
  })

  it('builds stable explicit-cue bollinger rules from normalized intent without injecting sma through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['触及布林带上轨后收盘确认做空', '触及布林带下轨后收盘确认做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    }
    const normalizedIntent = new StrategyIntentNormalizerService().normalize(checklist as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent(checklist, normalizedIntent)

    expect(spec.indicators).toEqual([
      { kind: 'bollingerBands', params: { period: 20, stdDev: 2 } },
    ])
    expect(spec.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'bollinger.upper_break',
          op: 'CROSS_OVER',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.lower_break',
          op: 'CROSS_UNDER',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.middle_revert',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        phase: 'risk',
      }),
    ]))
  })

  it('falls back to exit sideScope from normalized bollinger actions when sideScope is omitted', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          closureStatus: 'closed',
          unresolvedSlots: [],
          params: {
            band: 'middle',
            period: 20,
            stdDev: 2,
          },
        },
      ],
      actions: [{ key: 'close_long' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.middle_revert',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            source: 'normalized-intent',
            triggerKeys: ['bollinger.touch_middle'],
            actionKeys: ['CLOSE_LONG'],
            family: 'single-leg',
          }),
        }),
      }),
    ]))
  })

  it('keeps entry sideScope unset when normalized intent omits it', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_upper',
          phase: 'entry',
          closureStatus: 'closed',
          unresolvedSlots: [],
          params: {
            band: 'upper',
            period: 20,
            stdDev: 2,
          },
        },
      ],
      actions: [{ key: 'open_long' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'bollinger.upper_break',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
    ]))
    expect(spec.rules.find(rule => rule.phase === 'entry')?.sideScope).toBeUndefined()
  })

  it('builds outside-band reduce rules when earlyStop asks to reduce exposure', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前减仓',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'bollinger.bars_outside',
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('treats direct close wording as full exit for outside-band risk', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时直接平仓',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'bollinger.bars_outside',
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('builds outside-band full close from exitRules without requiring riskRules.earlyStop', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
        '价格连续3根K线在轨外时直接平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'exit-middle-1',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        metadata: { source: 'exitRules' },
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('prefers clarified exitRules over stale earlyStop text for outside-band action semantics', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
        '价格连续3根K线在轨外时直接平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时直接减仓',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        metadata: { source: 'exitRules' },
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('emits empty v2 rules when checklist has no recognizable trigger patterns', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['基于盘口情绪择机入场'],
      exitRules: ['根据主观判断离场'],
    })

    expect(spec).toEqual(expect.objectContaining({
      version: 2,
      rules: [],
      indicators: [],
      sizing: null,
    }))
  })

  it('does not inject implicit market/sizing/sma defaults when checklist is missing them', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['价格收盘确认突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    expect(spec.market).toEqual({
      exchange: 'binance',
      symbol: null,
      marketType: 'spot',
      defaultTimeframe: null,
    })
    expect(spec.indicators).toEqual([])
    expect(spec.sizing).toBeNull()
    expect(spec.dataRequirements).toEqual({ requiredTimeframes: [] })
  })

  it('parses moving-average short entry and short exit without forcing golden-entry/death-exit defaults', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线下穿长均线（死叉）时做空'],
      exitRules: ['短均线上穿长均线（金叉）时平空'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: { period: 20 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('uses checklist riskRules.exchange as canonical market exchange when provided', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线上穿长均线时做多'],
      exitRules: ['短均线下穿长均线时平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
  })

  it('builds RSI threshold entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['RSI 14 高于 70 时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'rsi',
      params: { period: 14 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_lte', value: 30 }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_gte', value: 70 }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds MACD cross entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['MACD 金叉时做多'],
      exitRules: ['MACD 死叉时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'macd',
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.golden_cross' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.death_cross' }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds MA 6/48 crossover periods into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['MA6 上穿 MA48 时做多开仓'],
      exitRules: ['MA6 下穿 MA48 时平多'],
      riskRules: { positionPct: 35, stopLossPct: 2, takeProfitPct: 0.6 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: { fastPeriod: 6, slowPeriod: 48 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.golden_cross',
          params: expect.objectContaining({ indicator: 'sma', fastPeriod: 6, slowPeriod: 48 }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.death_cross',
          params: expect.objectContaining({ indicator: 'sma', fastPeriod: 6, slowPeriod: 48 }),
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入'],
      exitRules: ['价格触达上方网格卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'custom',
      params: { compatibilityFamilyHint: 'grid' },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
    ]))
  })

  it('normalizes per-mille grid steps into percent while keeping grid params explicit', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按千分之5步长共 21 格执行区间网格买入'],
      exitRules: ['价格触达上方网格卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            levelCount: 21,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            levelCount: 21,
          }),
        }),
      }),
    ]))
  })

  it('builds short-grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空'],
      exitRules: ['价格回落触达下方网格买回平空'],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds bidirectional grid rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入',
        '在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空',
      ],
      exitRules: [
        '价格触达上方网格卖出',
        '价格回落触达下方网格买回平空',
      ],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules.filter(rule => rule.phase === 'entry')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'OPEN_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'OPEN_SHORT' })] }),
    ]))
    expect(spec.rules.filter(rule => rule.phase === 'exit')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'CLOSE_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })] }),
    ]))
  })

  it('builds stable bidirectional grid rules from normalized intent through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 的区间，每一格千分之5，不断低买高卖'],
      exitRules: ['持续网格卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
      },
    }
    const normalizedIntent = new StrategyIntentNormalizerService().normalize(checklist as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent(checklist, normalizedIntent)

    expect(spec.indicators).toEqual([
      { kind: 'custom', params: { compatibilityFamilyHint: 'grid' } },
    ])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            timeframe: '15m',
          }),
        }),
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            family: 'grid.range_rebalance',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
    ]))
  })

  it('expands bidirectional grid normalized intent into four directional rules', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['grid.range_rebalance'],
      triggers: [],
      actions: [
        { key: 'open_long' },
        { key: 'close_long' },
        { key: 'open_short' },
        { key: 'close_short' },
      ],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      grid: {
        family: 'grid.range_rebalance',
        range: {
          lower: 60000,
          upper: 80000,
        },
        stepPct: 0.5,
        sideMode: 'bidirectional',
        recycle: true,
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)
    const gridRules = spec.rules.filter(rule => rule.metadata?.normalized?.family === 'grid.range_rebalance')

    expect(gridRules).toHaveLength(4)
    expect(gridRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            triggerKeys: ['grid.range_rebalance'],
            actionKeys: ['OPEN_LONG'],
            family: 'grid.range_rebalance',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds breakout, take-profit, trailing-stop and time-stop rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破前20根K线最高价时做多，冷却 5 根K线'],
      exitRules: ['收益率达到 5% 止盈', '移动止损 10%', '持仓超过 12 根K线平仓'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        cooldownBars: 5,
        condition: expect.objectContaining({
          key: 'breakout.channel_high_break',
          params: expect.objectContaining({ period: 20 }),
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.trailing_stop_pct',
          value: 0.1,
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'risk.time_stop_bars',
          value: 12,
        }),
      }),
    ]))
  })

  it('builds Donchian breakout aliases into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破唐奇安上轨时做多'],
      exitRules: ['跌破唐奇安下轨时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'breakout.channel_high_break' }),
      }),
      expect.objectContaining({
        phase: 'entry',
      }),
    ]))
  })

  it('builds short breakout and short-side trade management rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['跌破前20根K线最低价时做空，冷却 5 根K线'],
      exitRules: ['空单止盈 5%', '移动止损 10% 平空', '持仓超过 12 根K线平空'],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        cooldownBars: 5,
        condition: expect.objectContaining({
          key: 'breakout.channel_low_break',
          params: expect.objectContaining({ period: 20 }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'both',
        condition: expect.objectContaining({
          key: 'risk.trailing_stop_pct',
          value: 0.1,
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'risk.time_stop_bars',
          value: 12,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds partial take-profit rules into canonical spec v2 using reduce actions', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('builds partial take-profit rules with explicit reduce ratio', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓 30% 止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'both',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: 'REDUCE_LONG',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
          expect.objectContaining({
            type: 'REDUCE_SHORT',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
        ]),
      }),
    ]))
  })

  it('builds price-change entry and exit rules from buy/sell wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'LTE',
          value: -0.01,
          params: expect.objectContaining({
            timeframe: '3m',
          }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'GTE',
          value: 0.02,
          params: expect.objectContaining({
            timeframe: '15m',
          }),
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('preserves explicit Bollinger parameters from rule text', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
      exitRules: ['价格回到布林带中轨(MA30)时平空'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'bollingerBands',
      params: {
        period: 30,
        stdDev: 2.5,
      },
    })
  })

  it('preserves explicit moving-average periods from crossover wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['5日线上穿20日线买入'],
      exitRules: ['5日线下穿20日线卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: {
        fastPeriod: 5,
        slowPeriod: 20,
      },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds price-change rules from raw Chinese minute and percent wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3分钟之内跌百分1买入'],
      exitRules: ['15分钟之内涨百分2卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-price-change-1',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          params: expect.objectContaining({ timeframe: '3m' }),
          value: -0.01,
        }),
      }),
      expect.objectContaining({
        id: 'exit-price-change-1',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
        condition: expect.objectContaining({
          key: 'price.change_pct',
          params: expect.objectContaining({ timeframe: '15m' }),
          value: 0.02,
        }),
      }),
    ]))
  })

  it('defaults generic sell wording to close short when the strategy only has short-side entries', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 下穿 EMA21 做空'],
      exitRules: ['EMA7 上穿 EMA21 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })
})
