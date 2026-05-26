import type { SemanticState } from '../../types/semantic-state'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

describe('SemanticStateMergeService', () => {
  const service = new SemanticStateMergeService()

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
  })
})
