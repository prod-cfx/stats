import type { SemanticState } from '../../types/semantic-state'
import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

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
    expect(json).toContain('rules[0].effects.positions[0]')
    expect(json).toContain('rules[0].effects.programs[0]')
    expect(json).not.toContain('OPEN_SHORT')
    expect(json).not.toContain('"value":0.9')
    expect(json).not.toContain('"value":999')
    expect(json).not.toContain('"valuePct":12')
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
      expect.objectContaining({ programKind }),
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

  it('keeps legacy rules array effects on the compatibility builder path', () => {
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

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
    const { ir } = new CanonicalSpecV2IrCompilerService().compile({ canonicalSpec: spec, fallback: compileFallback })

    expect(spec.rules.flatMap(rule => rule.actions).map(action => action.type)).toContain('OPEN_LONG')
    expect(ir.ruleBlocks.flatMap(block => block.actions).map(action => action.kind)).toContain('OPEN_LONG')
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
