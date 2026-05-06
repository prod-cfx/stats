import { SemanticStateMergeService } from '../semantic-state-merge.service'

describe('SemanticStateMergeService', () => {
  const service = new SemanticStateMergeService()

  it('merges action open slots when the same action is derived again', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [{
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
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [{ id: 'action-open-long-new', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.actions[0]).toEqual(expect.objectContaining({
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
        triggers: [
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
            }],
          },
        ],
        actions: [
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
          }],
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [{
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
        actions: [{
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
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:01:00.000Z',
      },
    })

    expect(merged.triggers[0]?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'price',
          verb: 'define',
          object: 'level_set',
        })]),
      }),
    ]))
    expect(merged.actions[0]?.contracts).toEqual(expect.arrayContaining([
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
        triggers: [],
        actions: [],
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
          }],
        }],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-05T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [],
        actions: [],
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
          }],
        }],
        position: null,
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
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
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

    expect(merged.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'grid.range_rebalance', status: 'locked' }),
    ]))
    expect(merged.contextSlots.timeframe?.value).toBe('15m')
  })

  it('keeps unresolved slots open when the current round only answers one part of a trigger', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers[0]?.params['reference.period']).toBe(50)
    expect(merged.triggers[0]?.status).toBe('open')
    expect(merged.triggers[0]?.openSlots).toEqual(expect.arrayContaining([
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
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
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
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
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

    expect(merged.triggers[0]).toEqual(expect.objectContaining({
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
        triggers: [
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
            }],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-04T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(1)
    expect(merged.triggers[0]).toEqual(expect.objectContaining({
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
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(1)
    expect(merged.triggers[0]).toEqual(expect.objectContaining({
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
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(1)
    expect(merged.triggers[0]).toEqual(expect.objectContaining({
      key: 'bollinger.touch_upper',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({
        confirmationMode: 'close_confirm',
      }),
    }))
  })

  it('keeps stronger persisted position, actions, and risk atoms when a weaker derived round only provides looser replacements', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [
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
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [
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
    expect(merged.actions).toEqual(expect.arrayContaining([
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
        triggers: [],
        actions: [],
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
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
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
        triggers: [
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
            evidence: `entry ${index}`,
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-05-06T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toEqual(expect.arrayContaining([
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
    expect(merged.triggers.filter(trigger => trigger.key === 'indicator.above')).toHaveLength(3)
  })

  it('matches each derived trigger at most once so persisted sibling atoms stay distinct', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
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
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(2)
    expect(merged.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-sibling-a',
      }),
      expect.objectContaining({
        id: 'entry-sibling-b',
      }),
    ]))
  })
})
