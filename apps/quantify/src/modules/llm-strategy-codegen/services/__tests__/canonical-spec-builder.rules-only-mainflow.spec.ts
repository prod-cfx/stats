import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

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

describe('CanonicalSpecBuilderService rules-only mainflow', () => {
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
})
