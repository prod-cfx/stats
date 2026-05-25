import type { SemanticState } from '../../types/semantic-state'
import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
}

function baseState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  }
}

function lockedContextSlot(slotKey: string, value: string) {
  return {
    slotKey,
    value,
    status: 'locked' as const,
    fieldPath: `contextSlots.${slotKey}`,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}

function programRule(program: AtomExprAtom): SemanticRule {
  return {
    id: `rule-${program.key.replace(/\./gu, '-')}`,
    phase: 'entry',
    sideScope: 'long',
    condition: {
      kind: 'atom',
      key: 'execution.on_start',
      params: {},
    },
    effects: {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [program],
    },
  }
}

describe('CanonicalSpecBuilderService rules-only mainflow', () => {
  const compileFallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  it('builds execution semantics from rule effects and ignores conflicting flat-only buckets', () => {
    const state = baseState({
      trigger: [{
        id: 'flat-trigger',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'short',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{
        id: 'flat-open-short',
        key: 'action.open_short',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      risk: [{
        id: 'flat-risk',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 12, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'single',
        value: 1,
        positionMode: 'short_only',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'ratio', value: 0.9, unit: 'ratio' },
      },
      positionConstraint: [{
        id: 'flat-grid',
        key: 'grid.range_rebalance',
        params: { sideMode: 'both', lower: 1, upper: 2, stepPct: 1 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      orchestration: [{
        id: 'flat-program',
        kind: 'program',
        key: 'program.fixed_grid_gated',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
        programKind: 'fixed_grid_gated',
        activeWhenRef: 'flat-gate',
        onDeactivate: 'keep',
        rebuildPolicy: 'static',
        gridParams: { anchorPrice: 10, levelCount: 2, stepPct: 1 },
        sizing: { mode: 'fixed_quote', value: 999 },
      }],
      rules: [{
        id: 'rule-entry-long',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'execution.on_start',
          params: {},
        },
        effects: {
          actions: [{
            kind: 'atom',
            key: 'action.open_long',
            params: {},
          }],
          risks: [{
            kind: 'atom',
            key: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price' },
          }],
          positions: [{
            kind: 'atom',
            key: 'position.per_order_budget',
            params: { value: 25, asset: 'USDT' },
          }],
          orchestration: [],
          programs: [{
            kind: 'atom',
            key: 'program.fixed_grid_gated',
            params: {
              anchorPrice: 55000,
              levelCount: 10,
              stepPct: 1,
              lowerBound: 50000,
              upperBound: 60000,
              onDeactivate: 'cancel',
              sizing: { mode: 'fixed_quote', value: 25 },
            },
          }],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const json = JSON.stringify(spec)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic-entry-rule-entry-long',
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({
          type: 'OPEN_LONG',
          atomKey: 'action.open_long',
          sourcePath: 'rules[0].effects.actions[0]',
        })],
      }),
      expect.objectContaining({
        phase: 'risk',
        metadata: expect.objectContaining({
          semanticKey: 'risk.stop_loss_pct',
          sourcePath: 'rules[0].effects.risks[0]',
        }),
      }),
    ]))
    expect(spec.orchestration?.programs).toEqual([
      expect.objectContaining({
        id: 'semantic-program-rule-entry-long-0-0',
        programKind: 'fixed_grid_gated',
        sourcePath: 'rules[0].effects.programs[0]',
      }),
    ])
    expect(spec.orchestration?.gates).toEqual([
      expect.objectContaining({
        id: 'rule-entry-long-rules-0-effects-programs-0-active-gate',
        sourcePath: 'rules[0].effects.programs[0]',
      }),
    ])
    expect(json).toContain('rules[0].effects.positions[0]')
    expect(json).toContain('rules[0].effects.programs[0]')
    expect(json).not.toContain('OPEN_SHORT')
    expect(json).not.toContain('"value":0.9')
    expect(json).not.toContain('"value":999')
    expect(json).not.toContain('"valuePct":12')
    expect(spec.metadata?.rulesHash).toBe(hashCanonical(state.rules))
  })

  it('projects grid.range_rebalance condition into canonical order program', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'BTCUSDT'),
        marketType: lockedContextSlot('marketType', 'perp'),
        timeframe: lockedContextSlot('timeframe', '15m'),
      },
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      },
      rules: [{
        id: 'program-bidirectional-grid-range',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            rangeLower: 60000,
            rangeUpper: 80000,
            stepPct: 0.5,
            sideMode: 'both',
            perGridSizing: 10,
            breakoutAction: 'continue',
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.orderPrograms).toEqual([
      expect.objectContaining({
        id: 'semantic-order-program-program-bidirectional-grid-range-rules-0-condition',
        programKind: 'fixed_grid_gated',
        mode: 'perp_neutral',
        levelSet: expect.objectContaining({
          lower: 60000,
          upper: 80000,
          spacingPct: 0.5,
        }),
        budget: {
          mode: 'per_order_pct_equity',
          value: 10,
        },
      }),
    ])
  })

  it('projects fixed-range grid condition when centerOffsetPct is zero', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'BTCUSDT'),
        marketType: lockedContextSlot('marketType', 'perp'),
        timeframe: lockedContextSlot('timeframe', '15m'),
      },
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      },
      rules: [{
        id: 'program-fixed-grid-zero-center-offset',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 0,
            recycle: 'true',
            stepPct: 0.1,
            sideMode: 'both',
            rangeLower: 79200,
            rangeUpper: 80200,
            perGridSizing: 10,
            breakoutAction: 'continue',
            centerOffsetPct: 0,
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.sizing).toEqual({ mode: 'RATIO', value: 0.1 })
    expect(spec.orderPrograms).toEqual([
      expect.objectContaining({
        sourcePath: 'rules[0].condition',
        levelSet: expect.objectContaining({
          lower: 79200,
          upper: 80200,
          spacingPct: 0.1,
        }),
        budget: {
          mode: 'per_order_pct_equity',
          value: 10,
        },
      }),
    ])
  })

  it('uses semantic quote sizing for rules-only order program sessions', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'ETHUSDT'),
        marketType: lockedContextSlot('marketType', 'spot'),
        timeframe: lockedContextSlot('timeframe', '1m'),
      },
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      },
      rules: [{
        id: 'program-centered-grid-quote-sizing',
        phase: 'program',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 10,
            sideMode: 'both',
            stepPct: 0.4,
            centerOffsetPct: 0.4,
            perGridSizing: 10,
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.sizing).toEqual({ mode: 'QUOTE', value: 10, asset: 'USDT' })
    expect(spec.orderPrograms?.[0]?.budget).toEqual({
      mode: 'per_order_quote',
      value: 10,
      asset: 'USDT',
    })
  })

  it('lets rules-only centered grid orderProgram own execution trace when effect program is non-static', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'ETHUSDT'),
        marketType: lockedContextSlot('marketType', 'spot'),
        timeframe: lockedContextSlot('timeframe', '1m'),
      },
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      },
      rules: [{
        id: 'program-centered-grid-stop-cancel',
        phase: 'program',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 10,
            sideMode: 'both',
            stepPct: 0.4,
            centerOffsetPct: 0.4,
            perGridSizing: 10,
            breakoutAction: 'stop',
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [{
            kind: 'atom',
            key: 'program.fixed_grid_gated',
            params: {
              stepPct: 0.4,
              levelCount: 10,
              lowerBound: 0,
              upperBound: 0,
              onDeactivate: 'cancel',
            },
          }],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({ canonicalSpec: spec, fallback: compileFallback })

    expect(spec.orderPrograms?.map(program => program.sourcePath)).toEqual(['rules[0].condition'])
    expect(spec.orchestration?.programs ?? []).toEqual([])
    expect(spec.orchestration?.gates ?? []).toEqual([])
    expect(ir.orderPrograms.map(program => program.sourcePath)).toEqual(['rules[0].condition'])
    expect(ir.orchestrationPrograms ?? []).toEqual([])
    expect(ir.orchestrationGates ?? []).toEqual([])
  })

  it('projects rules-only range grid condition with per-grid sizing even when position slot stays open', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'BTCUSDT'),
        marketType: lockedContextSlot('marketType', 'perp'),
        timeframe: lockedContextSlot('timeframe', '15m'),
      },
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        sizing: null,
        openSlots: [],
      },
      rules: [{
        id: 'deterministic-rule-1-entry-grid-range',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 10,
            recycle: 'true',
            stepPct: 0.4,
            sideMode: 'both',
            rangeLower: 79200,
            rangeUpper: 80200,
            perGridSizing: 10,
            breakoutAction: 'continue',
            centerOffsetPct: 0,
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.orderPrograms).toEqual([
      expect.objectContaining({
        sourcePath: 'rules[0].condition',
        levelSet: expect.objectContaining({
          lower: 79200,
          upper: 80200,
          gridCount: 10,
          spacingPct: 0.4,
        }),
        budget: {
          mode: 'per_order_quote',
          value: 10,
          asset: 'USDT',
        },
      }),
    ])
  })

  it('keeps duplicate rules-only grid order program active predicates scoped to each program', () => {
    const gridCondition = {
      kind: 'atom' as const,
      key: 'grid.range_rebalance',
      params: {
        levels: 10,
        recycle: 'true',
        stepPct: 0.4,
        sideMode: 'both',
        rangeLower: 79200,
        rangeUpper: 80200,
        perGridSizing: 10,
        breakoutAction: 'continue',
        centerOffsetPct: 0,
      },
    }
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'BTCUSDT'),
        marketType: lockedContextSlot('marketType', 'perp'),
        timeframe: lockedContextSlot('timeframe', '15m'),
      },
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        sizing: null,
        openSlots: [],
      },
      rules: [
        {
          id: 'grid-program-a',
          phase: 'program',
          sideScope: 'long',
          condition: gridCondition,
          effects: {
            actions: [],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
        {
          id: 'grid-program-b',
          phase: 'entry',
          sideScope: 'long',
          condition: gridCondition,
          effects: {
            actions: [],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
      ],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({ canonicalSpec: spec, fallback: compileFallback })

    expect(ir.orderPrograms).toHaveLength(2)
    expect(ir.orderPrograms.map(program => program.activeWhen)).toEqual([
      'semantic_order_program_grid_program_a_rules_0_condition_active_range',
      'semantic_order_program_grid_program_b_rules_1_condition_active_range',
    ])
  })

  it('keeps centered grid order program when orchestration program lacks static anchor', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'ETHUSDT'),
        marketType: lockedContextSlot('marketType', 'spot'),
        timeframe: lockedContextSlot('timeframe', '1m'),
      },
      rules: [{
        id: 'program-centered-grid',
        phase: 'program',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'execution.on_start',
          params: {},
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [{
            kind: 'atom',
            key: 'program.fixed_grid_gated',
            params: {
              mode: 'centered_percent_range',
              centerTiming: 'deployment',
              centerSource: 'last_price',
              halfRangePct: 0.4,
              gridCount: 10,
              spacingPct: 0.4,
              perGridSizing: 10,
              onDeactivate: 'cancel',
            },
          }],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.orchestration?.programs ?? []).toEqual([])
    expect(spec.orderPrograms).toEqual([
      expect.objectContaining({
        sourcePath: 'rules[0].effects.programs[0]',
        programKind: 'fixed_grid_gated',
        mode: 'spot',
        levelSet: expect.objectContaining({
          mode: 'centered_percent_range',
          halfRangePct: 0.4,
          gridCount: 10,
        }),
        budget: {
          mode: 'per_order_quote',
          value: 10,
          asset: 'USDT',
        },
      }),
    ])
  })

  it('projects centerOffsetPct grid condition into centered order program', () => {
    const state = baseState({
      contextSlots: {
        exchange: lockedContextSlot('exchange', 'okx'),
        symbol: lockedContextSlot('symbol', 'ETHUSDT'),
        marketType: lockedContextSlot('marketType', 'spot'),
        timeframe: lockedContextSlot('timeframe', '1m'),
      },
      rules: [{
        id: 'program-centered-grid-condition',
        phase: 'program',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 10,
            sideMode: 'both',
            stepPct: 0.4,
            centerOffsetPct: 0.4,
            perGridSizing: 10,
            breakoutAction: 'stop',
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.orderPrograms).toEqual([
      expect.objectContaining({
        sourcePath: 'rules[0].condition',
        programKind: 'fixed_grid_gated',
        mode: 'spot',
        levelSet: expect.objectContaining({
          mode: 'centered_percent_range',
          centerTiming: 'deployment',
          centerSource: 'last_price',
          halfRangePct: 0.4,
          gridCount: 10,
          spacingPct: 0.4,
        }),
        budget: {
          mode: 'per_order_quote',
          value: 10,
          asset: 'USDT',
        },
      }),
    ])
  })

  it.each([
    [
      'program.dynamic_grid',
      'dynamic_grid',
      {
        activeWhenRef: 'gate-dynamic',
        anchorLookbackBars: 20,
        anchorSide: 'mid',
        anchorDriftPct: 10,
        rebuildMinIntervalSec: 60,
        dynamicGridStep: { mode: 'pct', value: 0.5 },
        levelCount: 8,
        onDeactivate: 'cancel',
        sizing: { mode: 'fixed_quote', value: 50 },
      },
    ],
    [
      'program.adaptive_volatility_grid',
      'adaptive_volatility_grid',
      {
        activeWhenRef: 'gate-adaptive',
        atrPeriod: 14,
        atrMultiplier: 1.5,
        rangeMultiplier: 3,
        atrDriftPct: 20,
        rebuildCooldownSec: 300,
        minStepPct: 0.2,
        maxStepPct: 2,
        levelCount: 6,
        onDeactivate: 'keep',
        sizing: { mode: 'fixed_pct', value: 10 },
      },
    ],
    [
      'program.event_listener',
      'event_listener',
      {
        activeWhenRef: 'gate-event',
        eventSchemaRef: 'webhook_event',
        sourceRef: 'scope-data-event',
        permissionScope: 'webhook:tradingview',
        idempotencyKey: { fieldPath: 'event_id' },
        dedupWindowMs: 1000,
        expirationTtlMs: 5000,
        expirationPolicy: 'drop',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
      },
    ],
  ])('builds %s program effects from rules with source path', (key, programKind, params) => {
    const state = baseState({
      rules: [programRule({
        kind: 'atom',
        key,
        params,
      })],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const json = JSON.stringify(spec)

    expect(spec.orchestration?.programs).toEqual([
      expect.objectContaining({
        programKind,
        sourcePath: 'rules[0].effects.programs[0]',
      }),
    ])
    expect(json).toContain(key)
    expect(json).toContain('rules[0].effects.programs[0]')
  })

  it.each([
    ['program.fixed_grid_gated', 'fixed_grid_gated', {
      anchorPrice: 55000,
      levelCount: 10,
      stepPct: 1,
      sizing: { mode: 'fixed_quote', value: 25 },
    }],
    ['program.dynamic_grid', 'dynamic_grid', {
      anchorLookbackBars: 20,
      anchorSide: 'mid',
      anchorDriftPct: 10,
      rebuildMinIntervalSec: 60,
      dynamicGridStep: { mode: 'pct', value: 0.5 },
      levelCount: 8,
      sizing: { mode: 'fixed_quote', value: 50 },
    }],
    ['program.adaptive_volatility_grid', 'adaptive_volatility_grid', {
      atrPeriod: 14,
      atrMultiplier: 1.5,
      rangeMultiplier: 3,
      atrDriftPct: 20,
      rebuildCooldownSec: 300,
      minStepPct: 0.2,
      maxStepPct: 2,
      levelCount: 6,
      sizing: { mode: 'fixed_pct', value: 10 },
    }],
    ['program.event_listener', 'event_listener', {
      eventSchemaRef: 'webhook_event',
      sourceRef: 'event-feed-scope',
      permissionScope: 'webhook:tradingview',
      idempotencyKey: { fieldPath: 'event_id' },
      dedupWindowMs: 1000,
      expirationTtlMs: 5000,
      expirationPolicy: 'drop',
    }],
  ])('keeps %s program effects through IR compilation', (key, programKind, params) => {
    const state = baseState({
      rules: [programRule({
        kind: 'atom',
        key,
        params,
      })],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({ canonicalSpec: spec, fallback: compileFallback })

    expect(ir.orchestrationPrograms).toEqual([
      expect.objectContaining({ programKind, sourcePath: 'rules[0].effects.programs[0]' }),
    ])
    expect(ir.orchestrationGates).toEqual([
      expect.objectContaining({ sourcePath: 'rules[0].effects.programs[0]' }),
    ])
  })

  it('throws fail-closed for unsupported rules program effects', () => {
    const state = baseState({
      rules: [programRule({
        kind: 'atom',
        key: 'program.unknown_grid',
        params: {},
      })],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('UnsupportedSemanticRuleProgramEffect')
  })

  it('throws fail-closed for unsupported rules action effects with source path', () => {
    const state = baseState({
      rules: [{
        id: 'rule-unsupported-action',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.unsupported', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('UnsupportedSemanticRuleActionEffect: key=action.unsupported sourcePath=rules[0].effects.actions[0]')
  })

  it('throws fail-closed for unsupported rules risk effects with source path', () => {
    const state = baseState({
      rules: [{
        id: 'rule-unsupported-risk',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [],
          risks: [{ kind: 'atom', key: 'risk.unsupported', params: {} }],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('UnsupportedSemanticRuleRiskEffect: key=risk.unsupported sourcePath=rules[0].effects.risks[0]')
  })

  it('throws fail-closed for invalid rules position sizing with source path', () => {
    const state = baseState({
      rules: [{
        id: 'rule-invalid-position',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [],
          risks: [],
          positions: [{ kind: 'atom', key: 'position.per_order_budget', params: { value: 0, asset: 'USDT' } }],
          orchestration: [],
          programs: [],
        },
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('InvalidSemanticRulePositionEffect: key=position.per_order_budget sourcePath=rules[0].effects.positions[0]')
  })

  it('ignores lifecycle position constraints when resolving rules-only position sizing', () => {
    const state = baseState({
      rules: [{
        id: 'rule-pyramiding-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.breakout_up', params: { period: 1 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [{ kind: 'atom', key: 'position.pyramiding_limit', params: { maxLayers: 3 } }],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.sizing).toEqual({ mode: 'RATIO', value: 0.1 })
  })

  it('uses semantic position sizing for rules-only open-position actions when no rule sizing leaf exists', () => {
    const state = baseState({
      position: {
        mode: 'fixed_quote',
        value: 10,
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [{
        id: 'rule-open-long',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.sizing).toEqual({ mode: 'QUOTE', value: 10, asset: 'USDT' })
    expect(spec.rules[0]?.actions[0]).toEqual(expect.objectContaining({
      sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' },
    }))
  })

  it('lifts rules-only no-position entry predicates into gate rules before IR compilation', () => {
    const state = baseState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [{
        id: 'rule-open-if-green-and-empty',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'price.candle_pattern', params: { pattern: 'single_bull_bar', direction: 'bullish' } },
            { kind: 'atom', key: 'position.no_position', params: { sideScope: 'long' } },
          ],
        },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: compileFallback,
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'gate',
        actions: [expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({ key: 'price.candle_pattern' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
    ]))
    expect(ir.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
    ]))
  })

  it('does not compile rules-only pure no-position atoms as executable entry predicates', () => {
    const state = baseState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [
        {
          id: 'entry-breakout-retest-not-break-24h',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', key: 'price.breakout_up', params: { period: 24, reference: 'channel_high' } },
              { kind: 'atom', key: 'price.previous_extrema_retest', params: { memoryKey: 'auto', retestKind: 'not_break' } },
            ],
          },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [{ kind: 'atom', key: 'risk.remembered_level_stop', params: { levelKey: 'previous_extrema' } }],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
        {
          id: 'entry-breakout-retest-not-break-24h-eff-1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'position.no_position', params: { sideScope: 'long' } },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [{ kind: 'atom', key: 'risk.remembered_level_stop', params: { levelKey: 'previous_extrema' } }],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
      ],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: compileFallback,
    })

    expect(spec.rules.filter(rule => rule.phase === 'entry')).toHaveLength(1)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'gate',
        condition: expect.objectContaining({ key: 'position.no_position' }),
        actions: [expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' })],
      }),
    ]))
    expect(JSON.stringify(spec.rules.filter(rule => rule.phase === 'entry'))).not.toContain('position.no_position')
    expect(ir.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
    ]))
  })

  it('does not compile rules-only pure has-position atoms as executable exit predicates when risk rule owns the stop', () => {
    const state = baseState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [{
        id: 'exit-stoploss-entry-avg-5pct',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'position.has_position', params: { sideScope: 'both' } },
        effects: {
          actions: [
            { kind: 'atom', key: 'action.close_long', params: {} },
            { kind: 'atom', key: 'action.close_long', params: {} },
          ],
          risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', valuePct: 5 } }],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: compileFallback,
    })

    expect(spec.rules.filter(rule => rule.phase === 'exit')).toHaveLength(0)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({ key: 'position_loss_pct' }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
    expect(JSON.stringify(spec.rules)).not.toContain('position.has_position')
    expect(ir.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', value: 5 }),
    ]))
  })

  it('projects rules-only risk atoms used as exit conditions into canonical risk rules', () => {
    const state = baseState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      rules: [
        {
          id: 'entry-webhook-whale_buy-open-long',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'external.signal', params: { provider: 'webhook', signalId: 'whale_buy', secret: 'configured' } },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
        {
          id: 'exit-drawdown-5pct-from-entry-avg-close',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { basis: 'entry_avg_price', valuePct: 5 } },
          effects: {
            actions: [{ kind: 'atom', key: 'action.close_long', params: {} }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
      ],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const ir = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: compileFallback,
    })

    expect(spec.rules.filter(rule => rule.phase === 'exit')).toHaveLength(0)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({ key: 'position_loss_pct' }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
    expect(ir.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', value: 5 }),
    ]))
  })

  it('builds rules-only atomic risk effect rules instead of throwing unsupported risk effects', () => {
    const state = baseState({
      rules: [{
        id: 'entry-breakout-with-remembered-stop',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.breakout_up', params: { period: 24 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [{ kind: 'atom', key: 'risk.remembered_level_stop', params: { levelKey: 'breakout_price' } }],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({ key: 'risk.remembered_level_stop' }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('keeps distinct source paths for nested action risk position and program effect leaves', () => {
    const state = baseState({
      rules: [{
        id: 'rule-nested-effects',
        phase: 'entry',
        sideScope: 'both',
        condition: {
          kind: 'atom',
          key: 'execution.on_start',
          params: {},
        },
        effects: {
          actions: [{
            kind: 'and',
            children: [
              { kind: 'atom', key: 'action.open_long', params: {} },
              { kind: 'atom', key: 'action.open_short', params: {} },
            ],
          }],
          risks: [{
            kind: 'and',
            children: [
              { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
              { kind: 'atom', key: 'risk.take_profit_pct', params: { valuePct: 9, basis: 'entry_avg_price' } },
            ],
          }],
          positions: [{
            kind: 'not',
            child: { kind: 'atom', key: 'position.per_order_budget', params: { value: 40, asset: 'USDT' } },
          }],
          orchestration: [],
          programs: [{
            kind: 'and',
            children: [
              {
                kind: 'atom',
                key: 'program.fixed_grid_gated',
                params: {
                  anchorPrice: 55000,
                  levelCount: 10,
                  stepPct: 1,
                  sizing: { mode: 'fixed_quote', value: 25 },
                },
              },
              {
                kind: 'atom',
                key: 'program.dynamic_grid',
                params: {
                  activeWhenRef: 'gate-dynamic',
                  anchorLookbackBars: 20,
                  anchorSide: 'mid',
                  anchorDriftPct: 10,
                  rebuildMinIntervalSec: 60,
                  dynamicGridStep: { mode: 'pct', value: 0.5 },
                  levelCount: 8,
                  sizing: { mode: 'fixed_quote', value: 50 },
                },
              },
            ],
          }],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.rules.find(rule => rule.id === 'semantic-entry-rule-nested-effects')?.actions)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'OPEN_LONG', sourcePath: 'rules[0].effects.actions[0].and.children[0]' }),
        expect.objectContaining({ type: 'OPEN_SHORT', sourcePath: 'rules[0].effects.actions[0].and.children[1]' }),
      ]))
    expect(spec.rules.filter(rule => rule.phase === 'risk').map(rule => rule.metadata?.sourcePath))
      .toEqual([
        'rules[0].effects.risks[0].and.children[0]',
        'rules[0].effects.risks[0].and.children[1]',
      ])
    expect(spec.metadata?.rulesMainflow?.positionSourcePaths).toEqual([
      'rules[0].effects.positions[0].not.child',
    ])
    expect(spec.orchestration?.programs?.map(program => program.sourcePath)).toEqual([
      'rules[0].effects.programs[0].and.children[0]',
      'rules[0].effects.programs[0].and.children[1]',
    ])
  })

  it('builds supported orchestration effects from rules with source paths', () => {
    const state = baseState({
      rules: [{
        id: 'rule-orchestration',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [
            {
              kind: 'atom',
              key: 'scope.timeframe',
              params: {
                primaryTimeframe: '5m',
                requiredTimeframes: ['1h'],
                alignmentPolicy: 'strict',
              },
            },
            {
              kind: 'atom',
              key: 'portfolioRisk.drawdown_block',
              params: { mode: 'enforce', thresholdPct: 12 },
            },
            {
              kind: 'atom',
              key: 'portfolioRisk.symbol_exposure_cap',
              params: {
                mode: 'enforce',
                notionalCapPct: 30,
                effectWhenTriggered: 'reduce_exposure',
                boundSymbolScopeRef: 'rule-orchestration-rules-0-effects-orchestration-0',
              },
            },
            {
              kind: 'atom',
              key: 'portfolioRisk.substrategy_exposure_cap',
              params: {
                mode: 'enforce',
                notionalCapPct: 50,
                effectWhenTriggered: 'pause_substrategy',
                boundSubStrategyScopeRef: 'sub-strategy-a',
              },
            },
          ],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.dataRequirements.requiredTimeframes).toEqual(expect.arrayContaining(['5m', '1h']))
    expect(spec.orchestration?.scopes).toEqual([
      expect.objectContaining({
        scopeKind: 'timeframe',
        primaryTimeframe: '5m',
        requiredTimeframes: ['1h'],
        sourcePath: 'rules[0].effects.orchestration[0]',
      }),
    ])
    expect(spec.orchestration?.portfolioRisks).toEqual([
      expect.objectContaining({
        scope: 'portfolio',
        thresholdPct: 12,
        sourcePath: 'rules[0].effects.orchestration[1]',
      }),
      expect.objectContaining({
        scope: 'symbol',
        notionalCapPct: 30,
        symbolScopeRef: 'rule-orchestration-rules-0-effects-orchestration-0',
        effectWhenTriggered: 'reduce_exposure',
        sourcePath: 'rules[0].effects.orchestration[2]',
      }),
      expect.objectContaining({
        scope: 'subStrategy',
        notionalCapPct: 50,
        subStrategyScopeRef: 'sub-strategy-a',
        effectWhenTriggered: 'pause_substrategy',
        sourcePath: 'rules[0].effects.orchestration[3]',
      }),
    ])
  })

  it('throws fail-closed for unsupported rules orchestration effects with source path', () => {
    const state = baseState({
      rules: [{
        id: 'rule-unsupported-orchestration',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [{ kind: 'atom', key: 'scope.unsupported', params: {} }],
          programs: [],
        },
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('UnsupportedSemanticRuleOrchestrationEffect: key=scope.unsupported sourcePath=rules[0].effects.orchestration[0]')
  })

  it('throws fail-closed for both-side add_position effects', () => {
    const state = baseState({
      rules: [{
        id: 'rule-add-both',
        phase: 'entry',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{ kind: 'atom', key: 'action.add_position', params: { sizing: { kind: 'quote', value: 25, asset: 'USDT' } } }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('InvalidSemanticRuleActionEffect: key=action.add_position sourcePath=rules[0].effects.actions[0] sideScope=both')
  })

  it('uses atom sideScope for add_position effects before rule sideScope', () => {
    const state = baseState({
      rules: [{
        id: 'rule-add-short',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [{
            kind: 'atom',
            key: 'action.add_position',
            sideScope: 'short',
            params: { sizing: { kind: 'quote', value: 25, asset: 'USDT' } },
          }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.rules.find(rule => rule.id === 'semantic-entry-rule-add-short')?.actions).toEqual([
      expect.objectContaining({
        type: 'ADD_SHORT',
        atomKey: 'action.add_position',
        sourcePath: 'rules[0].effects.actions[0]',
      }),
    ])
  })

  it('builds program-phase DCA schedule rules without falling back to flat buckets', () => {
    const state = baseState({
      rules: [{
        id: 'rule-daily-dca',
        phase: 'program',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'execution.on_start', params: { timing: 'on_start' } },
        effects: {
          actions: [],
          risks: [],
          positions: [{
            kind: 'atom',
            key: 'position.dca_schedule',
            params: {
              triggerMode: 'time_interval',
              timeIntervalBars: 1,
              perOrderBudget: 100,
              maxOrders: 1,
            },
          }],
          orchestration: [],
          programs: [],
        },
      }],
    })

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic-dca-rule-daily-dca',
        phase: 'entry',
        actions: [expect.objectContaining({
          type: 'ADD_LONG',
          atomKey: 'position.dca_schedule',
          sourcePath: 'rules[0].effects.positions[0]',
        })],
        metadata: expect.objectContaining({
          dcaSchedule: expect.objectContaining({
            maxCount: 1,
            capitalCap: 100,
            timeIntervalBars: 1,
          }),
        }),
      }),
    ]))
  })

  it('throws fail-closed for legacy rules array effects instead of using flat buckets', () => {
    const state = baseState({
      trigger: [{
        id: 'legacy-flat-trigger',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{
        id: 'legacy-flat-action',
        key: 'action.open_long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_quote',
        value: 100,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      rules: [{
        id: 'legacy-array-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'execution.on_start',
          params: {},
        },
        effects: [{
          kind: 'atom',
          key: 'action.open_long',
          params: {},
        }],
      }],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('InvalidSemanticRulesMainflow: reason=legacy_effects_array')
  })

  it('throws fail-closed for mixed typed and legacy rules instead of falling back to flat buckets', () => {
    const state = baseState({
      trigger: [{
        id: 'flat-trigger',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'short',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{
        id: 'flat-open-short',
        key: 'action.open_short',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      rules: [
        {
          id: 'typed-entry',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'execution.on_start',
            params: {},
          },
          effects: {
            actions: [{
              kind: 'atom',
              key: 'action.open_long',
              params: {},
            }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        },
        {
          id: 'legacy-array-entry',
          phase: 'entry',
          sideScope: 'short',
          condition: {
            kind: 'atom',
            key: 'execution.on_start',
            params: {},
          },
          effects: [{
            kind: 'atom',
            key: 'action.open_short',
            params: {},
          }],
        },
      ],
    })

    expect(() => new CanonicalSpecBuilderService().buildFromSemanticState(state))
      .toThrow('MixedSemanticRuleEffectsShape: legacy_effects_array ruleId=legacy-array-entry ruleIndex=1')
  })
})
