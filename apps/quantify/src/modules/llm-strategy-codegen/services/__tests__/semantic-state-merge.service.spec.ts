import type { SemanticState } from '../../types/semantic-state'
import { collectAtomLeaves } from '../../types/atom-expr'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

describe('SemanticStateMergeService', () => {
  const service = new SemanticStateMergeService()

  describe.skip('legacy flat bucket merge behavior', () => {
  it('keeps merged rules authoritative when persisted and derived buckets disagree', () => {
    const condition = { kind: 'atom' as const, key: 'price.cross_over', params: { value: 100 } }
    const action = { kind: 'atom' as const, key: 'action.open_long', params: {} }
    const persisted: SemanticState = {
      version: 1,
      families: ['single-leg'],
      trigger: [{
        id: 'poison-trigger',
        key: 'price.cross_under',
        phase: 'entry',
        sideScope: 'long',
        params: { value: 1 },
        status: 'locked',
        source: 'derived',
        openSlots: [],
      }],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-entry',
        phase: 'entry',
        sideScope: 'long',
        condition,
        effects: {
          actions: [action],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      trigger: [],
      action: [],
      updatedAt: '2026-05-22T10:01:00.000Z',
    }

    const merged = service.merge({ persisted, derived })

    expect(merged.rules?.[0]).toMatchObject({
      id: 'rule-entry',
      condition,
      effects: {
        actions: [action],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      },
    })
  })

  it('preserves program phase and typed effects when a derived rule adds risk effects', () => {
    const condition = { kind: 'atom' as const, key: 'context.always', params: {} }
    const program = { kind: 'atom' as const, key: 'program.dynamic_grid', params: { levelCount: 5 } }
    const risk = { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }

    const persisted: SemanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      trigger: [],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-program-grid',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [program],
        },
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      updatedAt: '2026-05-22T10:01:00.000Z',
      rules: [{
        id: 'rule-program-grid',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [risk],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }

    const merged = service.merge({ persisted, derived })
    const [mergedRule] = merged.rules ?? []

    expect(merged.rules).toHaveLength(1)
    expect(mergedRule).toEqual(expect.objectContaining({ phase: 'program' }))
    expect(mergedRule?.effects).toEqual({
      actions: [],
      risks: [risk],
      positions: [],
      orchestration: [],
      programs: [program],
    })
  })

  it('keeps same-id rules separate when lifecycle phase differs', () => {
    const condition = { kind: 'atom' as const, key: 'context.always', params: {} }
    const program = { kind: 'atom' as const, key: 'program.dynamic_grid', params: { levelCount: 5 } }
    const risk = { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }

    const persisted: SemanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      trigger: [],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-grid',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [program],
        },
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      updatedAt: '2026-05-22T10:01:00.000Z',
      rules: [{
        id: 'rule-grid',
        phase: 'exit',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [risk],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }

    const merged = service.merge({ persisted, derived })
    const programRule = merged.rules?.find(rule => rule.phase === 'program')
    const exitRule = merged.rules?.find(rule => rule.phase === 'exit')

    expect(merged.rules).toHaveLength(2)
    expect(programRule?.effects).toEqual({
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [program],
    })
    expect(exitRule?.effects).toEqual({
      actions: [],
      risks: [risk],
      positions: [],
      orchestration: [],
      programs: [],
    })
  })

  it('merges legacy array effects into typed action effects when derived adds typed risk effects', () => {
    const condition = { kind: 'atom' as const, key: 'price.above', params: { value: 100 } }
    const action = { kind: 'atom' as const, key: 'action.open_long', params: { sizePct: 10 } }
    const risk = { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }

    const persisted: SemanticState = {
      version: 1,
      families: ['single-leg'],
      trigger: [],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-entry',
        phase: 'entry',
        sideScope: 'long',
        condition,
        effects: [action],
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      updatedAt: '2026-05-22T10:01:00.000Z',
      rules: [{
        id: 'rule-entry',
        phase: 'entry',
        sideScope: 'long',
        condition,
        effects: {
          actions: [],
          risks: [risk],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }

    const merged = service.merge({ persisted, derived })
    const [mergedRule] = merged.rules ?? []

    expect(merged.rules).toHaveLength(1)
    expect(mergedRule?.effects).toEqual({
      actions: [action],
      risks: [risk],
      positions: [],
      orchestration: [],
      programs: [],
    })
  })

  it('classifies legacy array effects by atom bucket before merging typed roles', () => {
    const condition = { kind: 'atom' as const, key: 'context.always', params: {} }
    const risk = { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }
    const position = { kind: 'atom' as const, key: 'position.pyramiding_limit', params: { maxLayers: 3 } }
    const program = { kind: 'atom' as const, key: 'program.dynamic_grid', params: { levelCount: 5 } }
    const action = { kind: 'atom' as const, key: 'action.open_long', params: {} }

    const persisted: SemanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      trigger: [],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-program',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: [risk, position, program],
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      updatedAt: '2026-05-22T10:01:00.000Z',
      rules: [{
        id: 'rule-program',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [action],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }

    const merged = service.merge({ persisted, derived })
    const [mergedRule] = merged.rules ?? []

    expect(mergedRule?.effects).toEqual({
      actions: [action],
      risks: [risk],
      positions: [position],
      orchestration: [],
      programs: [program],
    })
  })

  it('does not mutate typed rule inputs while merging effects', () => {
    const condition = { kind: 'atom' as const, key: 'context.always', params: {} }
    const program = { kind: 'atom' as const, key: 'program.dynamic_grid', params: { levelCount: 5 } }
    const risk = { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }
    const persisted: SemanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      trigger: [],
      action: [],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-22T10:00:00.000Z',
      rules: [{
        id: 'rule-program-grid',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [program],
        },
      }],
    }
    const derived: SemanticState = {
      ...persisted,
      updatedAt: '2026-05-22T10:01:00.000Z',
      rules: [{
        id: 'rule-program-grid',
        phase: 'program',
        sideScope: 'both',
        condition,
        effects: {
          actions: [],
          risks: [risk],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }
    const persistedBefore = structuredClone(persisted)
    const derivedBefore = structuredClone(derived)

    service.merge({ persisted, derived })

    expect(persisted).toEqual(persistedBefore)
    expect(derived).toEqual(derivedBefore)
  })

  it('merges action open slots when the same action is derived again', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [],
        action: [{
          id: 'action-open-long-old',
          key: 'open_long',
          status: 'open',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'action.order_type',
            fieldPath: 'actions[0].params.orderType',
            status: 'open',
            priority: 'behavior',
            questionHint: '请确认开仓订单类型。',
            affectsExecution: true,
          }],
        }],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [],
        action: [{ id: 'action-open-long-new', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.action[0]).toEqual(expect.objectContaining({
      id: 'action-open-long-old',
      key: 'open_long',
      openSlots: [expect.objectContaining({ slotKey: 'action.order_type' })],
    }))
  })

  it('preserves persisted atom contracts when a weaker derived patch omits or clears them', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'long',
            params: { sideMode: 'long_only' },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [{
              id: 'contract-grid-levels',
              kind: 'trigger',
              capabilities: [{
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: {
                  mode: 'centered_percent_range',
                  centerTiming: 'deployment',
                  centerSource: 'last_price',
                  halfRangePct: 0.4,
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
        action: [
          {
            id: 'open-grid',
            key: 'open_long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [{
              id: 'contract-grid-ladder',
              kind: 'action',
              capabilities: [
                {
                  domain: 'order_program',
                  verb: 'maintain',
                  object: 'limit_ladder',
                  shape: { orderType: 'limit', timeInForce: 'gtc', recycleOnFill: true },
                },
                {
                  domain: 'capital',
                  verb: 'allocate',
                  object: 'per_order_budget',
                  shape: { value: 10, asset: 'USDT' },
                },
              ],
              requires: [],
              params: {},
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          },
        ],
        risk: [
          {
            id: 'risk-boundary',
            key: 'risk.boundary_guard',
            params: {},
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [{
              id: 'contract-boundary-stop',
              kind: 'risk',
              capabilities: [{
                domain: 'guard',
                verb: 'enforce',
                object: 'boundary_cancel',
                shape: { onBreach: 'HALT_STRATEGY', cancelOrders: true },
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
        position: {
          mode: 'fixed_quote',
          value: 10,
          positionMode: 'long_only',
          sizing: { kind: 'quote', value: 10, asset: 'USDT' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-position-sizing',
            kind: 'position',
            capabilities: [{
              domain: 'capital',
              verb: 'allocate',
              object: 'position_sizing',
              shape: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [{
          id: 'derived-grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'long',
          params: { sideMode: 'long_only' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [],
        }],
        action: [{
          id: 'derived-open-grid',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [],
        }],
        risk: [{
          id: 'derived-risk-boundary',
          key: 'risk.boundary_guard',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [],
        }],
        position: {
          mode: 'fixed_quote',
          value: 10,
          positionMode: 'long_only',
          sizing: { kind: 'quote', value: 10, asset: 'USDT' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [],
        },
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:01:00.000Z',
      },
    })

    expect(merged.trigger[0]?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'price',
          verb: 'define',
          object: 'level_set',
        })]),
      }),
    ]))
    expect(merged.action[0]?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
          }),
          expect.objectContaining({
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: expect.objectContaining({ value: 10, asset: 'USDT' }),
          }),
        ]),
      }),
    ]))
    expect(merged.risk[0]?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'guard',
          verb: 'enforce',
          object: 'boundary_cancel',
        })]),
      }),
    ]))
    expect(merged.position?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'capital',
          verb: 'allocate',
          object: 'position_sizing',
        })]),
      }),
    ]))
  })

  it('coalesces atom contracts that share semantic capability or requirement keys', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [],
        action: [],
        risk: [{
          id: 'risk-boundary-stop',
          key: 'risk.boundary_guard',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [],
          contracts: [{
            id: 'risk-contract-boundary-stop',
            kind: 'risk',
            capabilities: [],
            requires: [
              { domain: 'guard', verb: 'enforce', object: 'boundary_cancel' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [],
        action: [],
        risk: [{
          id: 'derived-risk-boundary-stop',
          key: 'risk.boundary_guard',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-boundary-stop',
            kind: 'risk',
            capabilities: [{
              domain: 'guard',
              verb: 'enforce',
              object: 'boundary_cancel',
              shape: {
                onBreach: 'HALT_STRATEGY',
                cancelOrders: true,
                cancelScope: 'unfilled_grid_orders',
                regrid: false,
              },
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:01:00.000Z',
      },
    })

    expect(merged.risk[0]?.contracts).toHaveLength(1)
    expect(merged.risk[0]?.contracts?.[0]).toEqual(expect.objectContaining({
      capabilities: [expect.objectContaining({
        domain: 'guard',
        verb: 'enforce',
        object: 'boundary_cancel',
      })],
      requires: [expect.objectContaining({
        domain: 'guard',
        verb: 'enforce',
        object: 'boundary_cancel',
      })],
    }))
  })

  it('preserves locked grid atoms when the current round only contributes a timeframe context slot', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              recycle: true,
              breakoutAction: 'pause',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        trigger: [],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: null,
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '15m',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认策略主周期（例如 15m 或 1h）。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'grid.range_rebalance', status: 'locked' }),
    ]))
    expect(merged.contextSlots.timeframe?.value).toBe('15m')
  })

  it('keeps unresolved slots open when the current round only answers one part of a trigger', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-1',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
              'reference.period': 50,
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                value: 50,
                status: 'locked',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger[0]?.params['reference.period']).toBe(50)
    expect(merged.trigger[0]?.status).toBe('open')
    expect(merged.trigger[0]?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'reference.period.entry',
        status: 'locked',
        value: 50,
      }),
      expect.objectContaining({
        slotKey: 'confirmationMode.entry',
        status: 'open',
      }),
    ]))
  })

  it('keeps stronger persisted trigger params and context slots when a weaker derived round omits or loosens them', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
              'reference.period': 50,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            value: 'okx',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认交易所。',
            affectsExecution: true,
          },
          symbol: {
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
            value: 'BTCUSDT',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认交易标的。',
            affectsExecution: true,
          },
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
            value: 'perp',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认市场类型。',
            affectsExecution: true,
          },
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '1h',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认主周期。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'derived-entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            status: 'open',
            priority: 'context',
            questionHint: '请确认交易所。',
            affectsExecution: true,
          },
          symbol: {
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
            status: 'open',
            priority: 'context',
            questionHint: '请确认交易标的。',
            affectsExecution: true,
          },
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
            status: 'open',
            priority: 'context',
            questionHint: '请确认市场类型。',
            affectsExecution: true,
          },
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '15m',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认主周期。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger[0]).toEqual(expect.objectContaining({
      id: 'entry-ma',
      status: 'locked',
      source: 'user_explicit',
      params: expect.objectContaining({
        indicator: 'ma',
        referenceRole: 'long_term',
        'reference.period': 50,
        confirmationMode: 'close_confirm',
      }),
    }))
    expect(merged.contextSlots.exchange).toEqual(expect.objectContaining({
      value: 'okx',
      status: 'locked',
    }))
    expect(merged.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'BTCUSDT',
      status: 'locked',
    }))
    expect(merged.contextSlots.marketType).toEqual(expect.objectContaining({
      value: 'perp',
      status: 'locked',
    }))
    expect(merged.contextSlots.timeframe).toEqual(expect.objectContaining({
      value: '15m',
      status: 'locked',
    }))
  })

  it('does not reopen a locked grid trigger from weaker planner micro-slots', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'long',
            params: {
              sideMode: 'long_only',
              recycle: true,
              breakoutAction: 'pause',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [{
              id: 'contract-grid-centered-levels',
              kind: 'trigger',
              capabilities: [{
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: {
                  mode: 'centered_percent_range',
                  centerTiming: 'deployment',
                  centerSource: 'last_price',
                  halfRangePct: 0.4,
                  gridCount: 10,
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
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'derived-grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'long',
            params: {
              sideMode: 'long_only',
              recycle: true,
              breakoutAction: 'pause',
            },
            status: 'open',
            source: 'derived',
            openSlots: [{
              slotKey: 'grid.level_alignment',
              fieldPath: 'triggers[0].contracts[0].capabilities[0].shape.levelAlignment',
              status: 'open',
              priority: 'behavior',
              questionHint: '请确认中心价格是否必须正好落在网格点上。',
              affectsExecution: true,
            }],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-04T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toHaveLength(1)
    expect(merged.trigger[0]).toEqual(expect.objectContaining({
      id: 'grid-entry',
      status: 'locked',
      openSlots: [],
    }))
  })

  it('matches the same trigger when only one side omits sideScope', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'both',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              breakoutAction: 'pause',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        trigger: [
          {
            id: 'derived-grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              breakoutAction: 'pause',
            },
            status: 'open',
            source: 'derived',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toHaveLength(1)
    expect(merged.trigger[0]).toEqual(expect.objectContaining({
      id: 'grid-entry',
      key: 'grid.range_rebalance',
      sideScope: 'both',
      status: 'locked',
    }))
  })

  it('coalesces equivalent Bollinger triggers with different confirmation modes', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-upper-touch',
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
            params: {
              indicator: 'bollinger',
              period: 20,
              stdDev: 2,
              confirmationMode: 'touch',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-upper-close',
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
            params: {
              indicator: 'bollinger',
              period: 20,
              stdDev: 2,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toHaveLength(1)
    expect(merged.trigger[0]).toEqual(expect.objectContaining({
      key: 'bollinger.touch_upper',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({
        confirmationMode: 'close_confirm',
      }),
    }))
  })

  it('coalesces legacy and universal Bollinger boundary atoms after planner and seed merge', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'seed-entry-upper-boundary',
            key: 'price.detect.indicator_boundary',
            phase: 'entry',
            sideScope: 'short',
            params: {
              boundaryRole: 'upper',
              confirmationMode: 'close_confirm',
              indicator: { name: 'bollinger', period: 30, stdDev: 2.5 },
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
          {
            id: 'seed-exit-middle-boundary',
            key: 'price.detect.indicator_boundary',
            phase: 'exit',
            sideScope: 'short',
            params: {
              boundaryRole: 'middle',
              confirmationMode: 'touch',
              indicator: { name: 'bollinger', period: 30, stdDev: 2.5 },
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'planner-entry-upper-touch',
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
            params: {
              band: 'upper',
              confirmationMode: 'touch',
              period: 30,
              stdDev: 2.5,
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
          {
            id: 'planner-exit-middle-touch',
            key: 'bollinger.touch_middle',
            phase: 'exit',
            sideScope: 'short',
            params: {
              band: 'middle',
              confirmationMode: 'close_confirm',
              period: 30,
              stdDev: 2.5,
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toHaveLength(2)
    expect(merged.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        params: expect.objectContaining({ confirmationMode: 'close_confirm' }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        params: expect.objectContaining({ confirmationMode: 'close_confirm' }),
      }),
    ]))
    expect(merged.trigger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'price.detect.indicator_boundary' }),
    ]))
  })

  it('keeps stronger persisted position, actions, and risk atoms when a weaker derived round only provides looser replacements', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [],
        action: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
        risk: [
          {
            id: 'stop-loss',
            key: 'stop_loss_pct',
            params: { value: 5 },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
        },
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [],
        action: [
          { id: 'derived-open-long', key: 'open_long', status: 'open', source: 'derived' },
        ],
        risk: [
          {
            id: 'derived-stop-loss',
            key: 'stop_loss_pct',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.stopLossPct',
                fieldPath: 'risk[0].params.value',
                status: 'open',
                priority: 'risk',
                questionHint: '止损比例是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          status: 'open',
          source: 'derived',
        },
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.position).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      value: 0.1,
    }))
    expect(merged.action).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
      }),
      expect.objectContaining({
        id: 'close-long',
        key: 'close_long',
        status: 'locked',
        source: 'user_explicit',
      }),
    ]))
    expect(merged.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'stop-loss',
        key: 'stop_loss_pct',
        status: 'locked',
        source: 'user_explicit',
        params: expect.objectContaining({ value: 5 }),
      }),
    ]))
  })

  it('drops stale persisted risk basis slots after merge', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: [],
        trigger: [],
        action: [],
        risk: [
          {
            id: 'risk-1',
            key: 'risk.stop_loss_pct',
            params: { valuePct: 5 },
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.stopLossBasis',
                fieldPath: 'risk[0].params.stopLossBasis',
                questionHint: '请确认止损基准',
                status: 'open',
                priority: 'risk',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        trigger: [],
        action: [],
        risk: [
          {
            id: 'risk-1',
            key: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    })

    expect(merged.risk[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
      params: expect.objectContaining({
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })

  it('keeps persisted multi-timeframe siblings when a later round derives a different trigger', () => {
    const persistedEntryTimeframes = ['5m', '1h', '4h']
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          ...persistedEntryTimeframes.map((timeframe, index) => ({
            id: `entry-ema-${timeframe}`,
            key: 'indicator.above',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            params: {
              timeframe,
              indicator: 'ema',
              'reference.period': 20,
              confirmationMode: 'close_confirm',
            },
            status: 'locked' as const,
            source: 'user_explicit' as const,
            evidence: { text: `entry ${index}`, source: 'user_explicit' as const },
            openSlots: [],
          })),
          {
            id: 'exit-ema-15m',
            key: 'indicator.below',
            phase: 'exit',
            sideScope: 'long',
            params: {
              timeframe: '15m',
              indicator: 'ema',
              'reference.period': 20,
            },
            status: 'open',
            source: 'derived',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'derived-exit-ema-15m',
            key: 'indicator.below',
            phase: 'exit',
            sideScope: 'long',
            params: {
              timeframe: '15m',
              indicator: 'ema',
              'reference.period': 20,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-ema-5m',
        params: expect.objectContaining({ timeframe: '5m' }),
      }),
      expect.objectContaining({
        id: 'entry-ema-1h',
        params: expect.objectContaining({ timeframe: '1h' }),
      }),
      expect.objectContaining({
        id: 'entry-ema-4h',
        params: expect.objectContaining({ timeframe: '4h' }),
      }),
      expect.objectContaining({
        id: 'exit-ema-15m',
        status: 'locked',
        params: expect.objectContaining({
          timeframe: '15m',
          confirmationMode: 'close_confirm',
        }),
      }),
    ]))
    expect(merged.trigger.filter(trigger => trigger.key === 'indicator.above')).toHaveLength(3)
  })

  it('matches each derived trigger at most once so persisted sibling atoms stay distinct', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'entry-sibling-a',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry.a',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '第一个条件的长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
          {
            id: 'entry-sibling-b',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry.b',
                fieldPath: 'triggers[1].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '第二个条件的长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        trigger: [
          {
            id: 'derived-entry-open',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.trigger).toHaveLength(2)
    expect(merged.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-sibling-a',
      }),
      expect.objectContaining({
        id: 'entry-sibling-b',
      }),
    ]))
  })
  })

  // Issue #1403 子故障 D：rules[] 在风控轮次只补 risk rule 时，必须保留早轮的 entry/exit rules。
  //   回归现象：MA100+MACD 策略走完所有 clarification 后，UI summary 只剩「出场（做多）：止损」
  //   ——因为 LLM 最后一轮只回 risk rule，旧 derived-overrides-all 把 entry/exit 抹光。
  describe('rules[] identity merge (Issue #1403 子故障 D)', () => {
    function makeRule(id: string, phase: 'entry' | 'exit' | 'gate', key: string, params: Record<string, unknown> = {}) {
      return {
        id,
        phase,
        sideScope: 'both' as const,
        condition: { kind: 'atom' as const, key, params },
        effects: [],
      }
    }

    // 审查 Minor 3 简化：直接用 SemanticState 类型，去掉 `as unknown as Parameters<...>` 双重 cast。
    function emptyBase(): SemanticState {
      return {
        version: 1,
        families: [],
        trigger: [],
        action: [],
        risk: [],
        position: null,
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      }
    }

    it('preserves persisted entry/exit rules when derived only carries the risk rule', () => {
      const persisted: SemanticState = {
        ...emptyBase(),
        rules: [
          makeRule('rule-entry', 'entry', 'price.cross.ma_above'),
          makeRule('rule-exit', 'exit', 'macd.death_cross'),
        ],
      }
      const derived: SemanticState = {
        ...emptyBase(),
        rules: [makeRule('rule-risk', 'exit', 'risk.stop_loss_pct', { pct: 3 })],
        updatedAt: '2026-04-16T10:05:00.000Z',
      }

      const merged = service.merge({ persisted, derived })
      const rules = merged.rules ?? []
      expect(rules.map(r => r.id)).toEqual(['rule-entry', 'rule-exit', 'rule-risk'])
    })

    it('lets derived override persisted when rule.id matches', () => {
      const persisted: SemanticState = {
        ...emptyBase(),
        rules: [makeRule('rule-entry', 'entry', 'price.cross.ma_above', { period: 50 })],
      }
      const derived: SemanticState = {
        ...emptyBase(),
        rules: [makeRule('rule-entry', 'entry', 'price.cross.ma_above', { period: 100 })],
        updatedAt: '2026-04-16T10:05:00.000Z',
      }

      const merged = service.merge({ persisted, derived })
      const rules = merged.rules ?? []
      expect(rules).toHaveLength(1)
      const cond0 = rules[0]!.condition
      expect(cond0.kind).toBe('atom')
      if (cond0.kind === 'atom') {
        expect(cond0.params).toEqual({ period: 100 })
      }
    })

    // 审查 M2 修复：同 identity 折叠时 effects 字段必须保留 persisted（除非 derived 显式给非空 effects）
    it('preserves persisted effects when derived rule with same id has empty effects', () => {
      const persistedRule = {
        id: 'rule-entry',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        condition: { kind: 'atom' as const, key: 'macd.golden_cross', params: {} },
        effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
      }
      const derivedRule = {
        id: 'rule-entry',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        condition: { kind: 'atom' as const, key: 'macd.golden_cross', params: { fastPeriod: 12 } },
        effects: [], // 多轮场景：LLM 只回 condition 不回 effects
      }
      const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
      const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

      const merged = service.merge({ persisted, derived })
      const rules = merged.rules ?? []
      expect(rules).toHaveLength(1)
      // condition 取 derived（新 fastPeriod），effects 保留 persisted 并归一到 typed roles（避免 open_long 被抹）
      const cond = rules[0]!.condition
      expect(cond.kind).toBe('atom')
      if (cond.kind === 'atom') {
        expect(cond.params).toEqual({ fastPeriod: 12 })
      }
      expect(rules[0]!.effects).toEqual({
        actions: [expect.objectContaining({ key: 'action.open_long' })],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      })
    })

    it('Issue #1443: 不同 id 但同 condition+effects shape → 多轮累加去重（content-shape SoT）', () => {
      // 用户复测：多轮对话 LLM 每次产相同语义 rule 但 id 不同（如第 1 轮 'rule-entry-1' /
      // 第 2 轮 'planner-r-entry' / 第 3 轮 'dispatcher-lift-N-xxx'），旧实现按 id 去重不
      // 命中 → state.rules 累加，UI 显示重复 rule。新实现按 content shape 二次折叠。
      const persisted: SemanticState = {
        ...emptyBase(),
        rules: [{
          id: 'rule-r1-entry',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1, window: '3m' } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        }],
      }
      const derived: SemanticState = {
        ...emptyBase(),
        rules: [{
          id: 'planner-r-entry-NEW',  // 不同 id
          phase: 'entry',
          sideScope: 'long',
          // condition + effects shape 完全相同
          condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: -1, window: '3m' } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        }],
        updatedAt: '2026-05-17T01:00:00.000Z',
      }
      const merged = service.merge({ persisted, derived })
      const rules = merged.rules ?? []
      // 应只剩 1 条（content shape 折叠，留 derived 后入者）
      expect(rules).toHaveLength(1)
      expect(rules[0]!.id).toBe('planner-r-entry-NEW')
    })

    it('Issue #1443: 同 shape 不同 effects → 视为两条独立 rule（content 决定 identity）', () => {
      // shape 不同 → 不去重；这是真两条 rule
      const persisted: SemanticState = {
        ...emptyBase(),
        rules: [{
          id: 'r1',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { valuePct: -1 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        }],
      }
      const derived: SemanticState = {
        ...emptyBase(),
        rules: [{
          id: 'r2',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.percent_change', params: { valuePct: -1 } },
          effects: [{ kind: 'atom', key: 'action.add_position', params: {} }],  // 不同 effects
        }],
      }
      const merged = service.merge({ persisted, derived })
      expect(merged.rules ?? []).toHaveLength(2)
    })

    // Issue #1443 多轮风控翻倍真因（用户复测：止损止盈在选「合约」后翻倍）
    describe('Pass 3: 风控类 rule 归一化折叠（condition 全 bucket=risk）', () => {
      it('persisted sideScope=long SL + derived sideScope=both SL → 折叠为 1 条（perp 派生覆盖）', () => {
        const persisted: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-r1-sl',
            phase: 'exit',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -5 } },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-r2-sl',
            phase: 'exit',
            sideScope: 'both',
            condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -5 } },
            effects: [
              { kind: 'atom', key: 'action.close_long', params: {} },
              { kind: 'atom', key: 'action.close_short', params: {} },
            ],
          }],
          updatedAt: '2026-05-17T01:00:00.000Z',
        }
        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []
        expect(rules).toHaveLength(1)
        expect(rules[0]!.id).toBe('rule-r2-sl')
        expect(rules[0]!.sideScope).toBe('both')
      })

      it('persisted SL valuePct=-5 + derived SL valuePct=-10 → 保留 2 条（不同语义不折叠）', () => {
        const persisted: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-sl-5',
            phase: 'exit',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -5 } },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-sl-10',
            phase: 'exit',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -10 } },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const merged = service.merge({ persisted, derived })
        expect((merged.rules ?? []).length).toBe(2)
      })

      it('persisted TP + derived TP（sideScope 漂移）→ 折叠 1 条', () => {
        const persisted: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-tp-long',
            phase: 'exit',
            sideScope: 'long',
            condition: { kind: 'atom', key: 'risk.take_profit_pct', params: { valuePct: 10 } },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'rule-tp-both',
            phase: 'exit',
            sideScope: 'both',
            condition: { kind: 'atom', key: 'risk.take_profit_pct', params: { valuePct: 10 } },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const merged = service.merge({ persisted, derived })
        expect((merged.rules ?? []).length).toBe(1)
      })

      it('混合 condition（AND(price.above, risk.stop_loss_pct)）→ 不走风控归一化，按 Pass 2 shape 处理', () => {
        // 混合 condition 不视为纯风控 rule，保守保留 Pass 2 行为
        const persisted: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'r-mix-1',
            phase: 'exit',
            sideScope: 'long',
            condition: {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'price.above_indicator', params: {} },
                { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -5 } },
              ],
            },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'r-mix-2',
            phase: 'exit',
            sideScope: 'both',
            condition: {
              kind: 'and',
              children: [
                { kind: 'atom', key: 'price.above_indicator', params: {} },
                { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: -5 } },
              ],
            },
            effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          }],
        }
        const merged = service.merge({ persisted, derived })
        // sideScope 不同 → Pass 2 shape 不同 → 保留 2 条（这是混合条件的保守行为）
        expect((merged.rules ?? []).length).toBe(2)
      })
    })

    it('keeps persisted rules untouched when derived has no rules field', () => {
      const persisted: SemanticState = {
        ...emptyBase(),
        rules: [makeRule('rule-entry', 'entry', 'price.cross.ma_above')],
      }
      const derived: SemanticState = { ...emptyBase(), updatedAt: '2026-04-16T10:05:00.000Z' }

      const merged = service.merge({ persisted, derived })
      expect((merged.rules ?? []).map(r => r.id)).toEqual(['rule-entry'])
    })

    // Issue #1633 C2：跨轮 clarification 单调性守门
    describe('Issue #1633 C2: event-class atom restoration across clarification turns', () => {
      it('restores lost condition.sequence node when derived simplifies same id rule', () => {
        const persistedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: {
            kind: 'and' as const,
            children: [
              { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
              {
                kind: 'sequence' as const,
                steps: [
                  { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', period: 20 } },
                ],
              },
            ],
          },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        // turn 1: LLM 只重述 indicator.above，把 sequence 节点丢了
        const derivedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []
        expect(rules).toHaveLength(1)
        const cond = rules[0]!.condition
        expect(cond.kind).toBe('and')
        if (cond.kind === 'and') {
          // sequence 节点应被恢复
          const hasSeq = cond.children.some(c => c.kind === 'sequence')
          expect(hasSeq).toBe(true)
        }
      })

      it('restores lost event-class atom leaf when derived simplifies same id rule', () => {
        const persistedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: {
            kind: 'and' as const,
            children: [
              { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
              { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', period: 20 } },
            ],
          },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        // derived 丢了 cross_over
        const derivedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []
        expect(rules).toHaveLength(1)
        const cond = rules[0]!.condition
        expect(cond.kind).toBe('and')
        if (cond.kind === 'and') {
          const keys = cond.children.filter(c => c.kind === 'atom').map(c => (c as { key: string }).key)
          expect(keys).toContain('indicator.cross_over')
          expect(keys).toContain('indicator.above')
        }
      })

      it('restores lost state gate leaf when context-slot clarification simplifies same id entry', () => {
        const persistedRule = {
          id: 'entry-15m-ema20-cross-ema50-long',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: {
            kind: 'and' as const,
            children: [
              { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
              { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ma', 'reference.period': 50, timeframe: '1h' } },
            ],
          },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        const derivedRule = {
          id: 'entry-15m-ema20-cross-ema50-long',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const keys = collectAtomLeaves((merged.rules ?? [])[0]!.condition).map(leaf => leaf.key)

        expect(keys).toEqual(expect.arrayContaining(['indicator.cross_over', 'indicator.above']))
      })

      it('does NOT restore when derived replaces event-class leaf with a different event leaf', () => {
        // 合法替换 cross_over → cross_under：用户主动改方向，不应再注入旧 cross_over
        const persistedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', period: 20 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        }
        const derivedRule = {
          id: 'rule-entry',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_under', params: { indicator: 'ema', period: 20 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_short', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []
        expect(rules).toHaveLength(1)
        const cond = rules[0]!.condition
        // 不应包含旧的 cross_over
        expect(cond.kind).toBe('atom')
        if (cond.kind === 'atom') {
          expect(cond.key).toBe('indicator.cross_under')
        }
      })

      it('leaves non-event rules (e.g. risk rsi_gte) untouched', () => {
        const persistedRule = {
          id: 'rule-exit',
          phase: 'exit' as const,
          sideScope: 'both' as const,
          condition: { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { pct: 5 } },
          effects: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
        }
        const derivedRule = {
          id: 'rule-exit',
          phase: 'exit' as const,
          sideScope: 'both' as const,
          condition: { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { pct: 3 } },
          effects: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []
        expect(rules).toHaveLength(1)
        const cond = rules[0]!.condition
        // derived 覆盖 persisted（无 event-class 叶子可保护）
        expect(cond.kind).toBe('atom')
        if (cond.kind === 'atom') {
          expect(cond.key).toBe('risk.stop_loss_pct')
          expect(cond.params).toEqual({ pct: 3 })
        }
      })

      it('repairs short exit action side during cross-turn merge', () => {
        const persistedRule = {
          id: 'rule-exit-short',
          phase: 'exit' as const,
          sideScope: 'short' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
          effects: [{ kind: 'atom' as const, key: 'action.close_short', params: {} }],
        }
        const derivedRule = {
          ...persistedRule,
          effects: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const text = JSON.stringify(merged.rules)

        expect(text).toContain('action.close_short')
        expect(text).not.toContain('action.close_long')
      })

      it('drops same-side entry whose condition duplicates an exit after clarification merge', () => {
        const exitRule = {
          id: 'rule-exit-short',
          phase: 'exit' as const,
          sideScope: 'short' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
          effects: [{ kind: 'atom' as const, key: 'action.close_short', params: {} }],
        }
        const duplicateEntry = {
          id: 'rule-entry-short-duplicate-exit',
          phase: 'entry' as const,
          sideScope: 'short' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_short', params: {} }],
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [exitRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [duplicateEntry], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const rules = merged.rules ?? []

        expect(rules).toHaveLength(1)
        expect(rules[0]!.phase).toBe('exit')
        expect(JSON.stringify(rules)).not.toContain('action.open_short')
      })

      it('drops same-side entry when its condition is covered by a richer exit condition with placeholder MA params', () => {
        const exitRule = {
          id: 'rule-exit-short-trailing',
          phase: 'exit' as const,
          sideScope: 'short' as const,
          condition: {
            kind: 'and' as const,
            children: [
              { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
              { kind: 'atom' as const, key: 'risk.trailing_stop_pct', params: { valuePct: 3 } },
            ],
          },
          effects: {
            actions: [{ kind: 'atom' as const, key: 'action.close_short', params: {} }],
            risks: [
              { kind: 'atom' as const, key: 'risk.trailing_stop_pct', params: { valuePct: 3, activationPct: 0 } },
              { kind: 'atom' as const, key: 'risk.trailing_stop_pct', params: { valuePct: 3 } },
            ],
            positions: [],
            orchestration: [],
            programs: [],
          },
        }
        const duplicateEntry = {
          id: 'rule-entry-short-duplicate-exit',
          phase: 'entry' as const,
          sideScope: 'short' as const,
          condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 0 } },
          effects: [{ kind: 'atom' as const, key: 'action.open_short', params: {} }],
        }
        const derived: SemanticState = { ...emptyBase(), rules: [duplicateEntry, exitRule] }

        const merged = service.merge({ persisted: null, derived })
        const text = JSON.stringify(merged.rules)

        expect(merged.rules).toHaveLength(1)
        expect(merged.rules?.[0]?.phase).toBe('exit')
        expect(text).not.toContain('action.open_short')
        const effects = merged.rules?.[0]?.effects
        expect(!Array.isArray(effects) && effects?.risks).toHaveLength(1)
      })

      it('folds duplicated lifecycle rules with the same condition and prefers ratio sizing', () => {
        const condition = { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 15, slowPeriod: 20 } }
        const persistedRule = {
          id: 'rule-entry-ratio',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition,
          effects: {
            actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
            risks: [],
            positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } } }],
            orchestration: [],
            programs: [],
          },
        }
        const derivedRule = {
          id: 'rule-entry-quote-duplicate',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          condition,
          effects: {
            actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
            risks: [],
            positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'quote', value: 10, asset: 'USDT' } } }],
            orchestration: [],
            programs: [],
          },
        }
        const persisted: SemanticState = { ...emptyBase(), rules: [persistedRule] }
        const derived: SemanticState = { ...emptyBase(), rules: [derivedRule], updatedAt: '2026-04-16T10:05:00.000Z' }

        const merged = service.merge({ persisted, derived })
        const text = JSON.stringify(merged.rules)

        expect(merged.rules).toHaveLength(1)
        expect(text).toContain('"kind":"ratio"')
        expect(text).not.toContain('"kind":"quote"')
      })

      it('applies lifecycle finalize to initial derived state without persisted state', () => {
        const condition = { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 15, slowPeriod: 20 } }
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'entry-ratio',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition,
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } } }],
              orchestration: [],
              programs: [],
            },
          }, {
            id: 'entry-quote',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition,
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'quote', value: 10, asset: 'USDT' } } }],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const text = JSON.stringify(merged.rules)

        expect(merged.rules).toHaveLength(1)
        expect(text).toContain('"kind":"ratio"')
        expect(text).not.toContain('"kind":"quote"')
      })

      it('dedupes duplicate sizing and cooldown effects inside one lifecycle rule', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'entry-with-duplicate-effects',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 } },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [
                { kind: 'atom' as const, key: 'risk.cooldown', params: { durationBars: 5 } },
                { kind: 'atom' as const, key: 'risk.cooldown', params: { durationBars: 5 }, evidence: { text: '冷却 5 根 K 线' } },
              ],
              positions: [
                { kind: 'atom' as const, key: 'position.sizing', params: { mode: 'fixed_pct', value: 10 } },
                { kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } } },
              ],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const text = JSON.stringify(merged.rules)

        expect(text.match(/risk\.cooldown/gu)).toHaveLength(1)
        expect(text.match(/position\.sizing/gu)).toHaveLength(1)
        expect(text).toContain('"kind":"ratio"')
      })

      it('drops actionless lifecycle noise instead of counting it as duplicate exit', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'exit-rsi-close-short',
            phase: 'exit' as const,
            sideScope: 'short' as const,
            condition: { kind: 'atom' as const, key: 'oscillator.rsi_lte', params: { period: 14, value: 30 } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.close_short', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }, {
            id: 'exit-actionless-stoploss-noise',
            phase: 'exit' as const,
            sideScope: 'short' as const,
            condition: { kind: 'atom' as const, key: 'position.has_position', params: { sideScope: 'short' } },
            effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.rules?.map(rule => rule.id)).toEqual(['exit-rsi-close-short'])
      })

      it('folds dispatcher entry with noisy MA periods into planner entry', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'planner-entry-ema20-ema50',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: {
              kind: 'and' as const,
              children: [
                { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
                { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 50 } },
              ],
            },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [{ kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 3 } }],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } } }],
              orchestration: [],
              programs: [],
            },
          }, {
            id: 'dispatcher-entry-noisy-ema15-ema20',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: {
              kind: 'and' as const,
              children: [
                { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 15, slowPeriod: 20, signalPeriod: 50 } },
                { kind: 'atom' as const, key: 'indicator.above', params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 50 } },
              ],
            },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } } }],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const entryRules = merged.rules?.filter(rule => rule.phase === 'entry') ?? []
        const text = JSON.stringify(entryRules)

        expect(entryRules).toHaveLength(1)
        expect(text.match(/position\.sizing/gu)).toHaveLength(1)
        expect(text).toContain('risk.stop_loss_pct')
      })

      it('repairs lifecycle phase and action when condition evidence says open long', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'wrong-exit-from-open-intent',
            phase: 'exit' as const,
            sideScope: 'long' as const,
            condition: {
              kind: 'atom' as const,
              key: 'oscillator.rsi_lte',
              params: { period: 14, value: 30 },
              evidence: { text: 'RSI14 低于 30 做多' },
            },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
              risks: [{ kind: 'atom' as const, key: 'risk.partial_take_profit', params: { profitPct: 5, ratio: 0.5 } }],
              positions: [],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const [rule] = merged.rules ?? []
        const actionKeys = rule?.effects && 'actions' in rule.effects
          ? rule.effects.actions.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
          : []

        expect(rule?.phase).toBe('entry')
        expect(actionKeys).toEqual(['action.open_long'])
        expect(JSON.stringify(rule)).toContain('risk.partial_take_profit')
      })

      it('repairs missing_entry_rules evidence even when full utterance also mentions exits', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'wrong-exit-from-missing-entry-path',
            phase: 'exit' as const,
            sideScope: 'long' as const,
            condition: {
              kind: 'atom' as const,
              key: 'oscillator.rsi_lte',
              params: { period: 14, value: 30 },
              evidence: { text: 'rulesMainflow.missing_entry_rules: RSI14 低于 30 做多，盈利 5% 平一半' },
            },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const [rule] = merged.rules ?? []

        expect(rule?.phase).toBe('entry')
        expect(JSON.stringify(rule)).toContain('action.open_long')
      })

      it('drops risk-only open entries when risk semantics already live on the real entry', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'entry-rsi-with-tp',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'oscillator.rsi_lte', params: { period: 14, value: 30 } },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
              risks: [{ kind: 'atom' as const, key: 'risk.take_profit_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
              positions: [],
              orchestration: [],
              programs: [],
            },
          }, {
            id: 'risk-tp-open-noise',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'risk.take_profit_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.rules?.map(rule => rule.id)).toEqual(['entry-rsi-with-tp'])
      })

      it('drops position-presence open entries when a real entry exists', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'entry-breakout',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'price.breakout_up', params: { period: 20 } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }, {
            id: 'position-presence-open-noise',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'position.has_position', params: { sideScope: 'long' } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.rules?.map(rule => rule.id)).toEqual(['entry-breakout'])
      })

      it('drops always-on open entries when a real entry exists', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'entry-breakout',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'price.breakout_up', params: { period: 20 } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }, {
            id: 'always-on-open-noise',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'execution.on_start', params: { occurrence: 'once' } },
            effects: { actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.rules?.map(rule => rule.id)).toEqual(['entry-breakout'])
      })

      it('treats zero breakout buffer as semantic noise when folding duplicate exits', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          rules: [{
            id: 'exit-breakout-no-buffer',
            phase: 'exit' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'price.breakout_up', params: { period: 20, reference: 'channel_high' } },
            effects: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
          }, {
            id: 'exit-breakout-zero-buffer',
            phase: 'exit' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'price.breakout_up', params: { period: 20, reference: 'channel_high', bufferPct: 0 } },
            effects: [{ kind: 'atom' as const, key: 'action.close_long', params: {} }],
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.rules).toHaveLength(1)
      })

      it('adds scope.timeframe from context when rules lost timeframe effects', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          contextSlots: {
            ...emptyBase().contextSlots,
            timeframe: { value: '15m', status: 'locked', source: 'user_explicit', openSlots: [] },
          },
          rules: [{
            id: 'entry-no-scope',
            phase: 'entry' as const,
            sideScope: 'long' as const,
            condition: { kind: 'atom' as const, key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
            effects: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const text = JSON.stringify(merged.rules)

        expect(text).toContain('scope.timeframe')
        expect(text).toContain('15m')
      })

      it('repairs top-level ratio position from rule sizing when clarification captured another percentage', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          position: {
            mode: 'fixed_ratio',
            value: 0.02,
            sizing: { kind: 'ratio', unit: 'ratio', value: 0.02 },
            source: 'user_explicit',
            status: 'locked',
            openSlots: [],
            positionMode: 'short_only',
          },
          rules: [{
            id: 'entry-sizing-truth',
            phase: 'entry' as const,
            sideScope: 'short' as const,
            condition: { kind: 'atom' as const, key: 'indicator.cross_under', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
            effects: {
              actions: [{ kind: 'atom' as const, key: 'action.open_short', params: {} }],
              risks: [],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 } } }],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })

        expect(merged.position?.value).toBe(0.1)
        expect(merged.position?.sizing).toEqual({ kind: 'ratio', unit: 'ratio', value: 0.1 })
      })

      it('dedupes reverse_position actions by keeping the side-complete action and repairs position mode', () => {
        const derived: SemanticState = {
          ...emptyBase(),
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
            source: 'derived',
            status: 'locked',
            openSlots: [],
            positionMode: 'long_only',
          },
          rules: [{
            id: 'entry-reverse-short',
            phase: 'entry' as const,
            sideScope: 'short' as const,
            condition: { kind: 'atom' as const, key: 'indicator.cross_under', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50 } },
            effects: {
              actions: [
                { kind: 'atom' as const, key: 'action.reverse_position', params: { toSide: 'short', fromSide: 'long', sizingSource: 'fixed', sameBarPolicy: 'next_bar_only' } },
                { kind: 'atom' as const, key: 'action.reverse_position', params: { sizingSource: 'fixed', sameBarPolicy: 'next_bar_only' } },
              ],
              risks: [],
              positions: [{ kind: 'atom' as const, key: 'position.sizing', params: { sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 } } }],
              orchestration: [],
              programs: [],
            },
          }],
        }

        const merged = service.merge({ persisted: null, derived })
        const actions = !Array.isArray(merged.rules?.[0]?.effects) ? merged.rules?.[0]?.effects.actions ?? [] : []

        expect(actions).toHaveLength(1)
        expect(actions[0]).toEqual(expect.objectContaining({
          key: 'action.reverse_position',
          params: expect.objectContaining({ fromSide: 'long', toSide: 'short' }),
        }))
        expect(merged.position?.positionMode).toBe('long_short')
      })
    })
  })
})
