import type { SemanticState } from '../../types/semantic-state'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'

describe('SemanticContractReadinessService', () => {
  it('writes missing price and capital requirements to the requiring action open slots', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [{
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc' },
          }],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
            { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'capital',
        verb: 'allocate',
        object: 'per_order_budget',
      },
    ])
    expect(result.state.actions[0].openSlots).toEqual([
      {
        slotKey: 'contract.requirement.price.define.level_set',
        fieldPath: 'actions[action-1].contracts[action-contract-1].requires.price.define.level_set',
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '请补充 price define level_set 的执行语义。',
        evidence: {
          source: 'derived',
          text: 'Missing semantic contract requirement action-contract-1: price.define.level_set',
        },
      },
      {
        slotKey: 'contract.requirement.capital.allocate.per_order_budget',
        fieldPath: 'actions[action-1].contracts[action-contract-1].requires.capital.allocate.per_order_budget',
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '请补充 capital allocate per_order_budget 的执行语义。',
        evidence: {
          source: 'derived',
          text: 'Missing semantic contract requirement action-contract-1: capital.allocate.per_order_budget',
        },
      },
    ])
  })

  it('does not duplicate existing open slots and preserves the original question hint', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.market.read.latest_bar',
          fieldPath: 'actions[action-1].contracts[action-contract-1].requires.market.read.latest_bar',
          status: 'open',
          priority: 'context',
          affectsExecution: true,
          questionHint: '原始问题提示',
          value: null,
        }],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'market', verb: 'read', object: 'latest_bar' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.actions[0].openSlots).toHaveLength(1)
    expect(result.state.actions[0].openSlots?.[0]).toEqual(expect.objectContaining({
      questionHint: '原始问题提示',
      value: null,
    }))
  })

  it('reopens answered contract requirement slots when the capability is still missing', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.capital.allocate.per_order_budget',
          fieldPath: 'actions[action-1].contracts[action-contract-1].requires.capital.allocate.per_order_budget',
          status: 'locked',
          priority: 'behavior',
          affectsExecution: true,
          questionHint: '用户已回答过的问题',
          value: '每单 100 USDT',
          evidence: {
            source: 'user_explicit',
            text: '每单 100 USDT',
          },
        }],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.actions[0].openSlots).toHaveLength(1)
    expect(result.state.actions[0].openSlots?.[0]).toEqual({
      slotKey: 'contract.requirement.capital.allocate.per_order_budget',
      fieldPath: 'actions[action-1].contracts[action-contract-1].requires.capital.allocate.per_order_budget',
      status: 'open',
      priority: 'behavior',
      affectsExecution: true,
      questionHint: '请补充 capital allocate per_order_budget 的执行语义。',
      evidence: {
        source: 'derived',
        text: 'Missing semantic contract requirement action-contract-1: capital.allocate.per_order_budget',
      },
    })
    expect(result.state.actions[0].openSlots?.filter(slot => slot.status === 'open')).toHaveLength(1)
  })

  it('clears stale contract requirement slots when the capability becomes satisfied', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'contract.requirement.capital.allocate.per_order_budget',
            fieldPath: 'actions[action-1].contracts[action-contract-1].requires.capital.allocate.per_order_budget',
            status: 'open',
            priority: 'behavior',
            affectsExecution: true,
            questionHint: '请补充 capital allocate per_order_budget 的执行语义。',
          },
          {
            slotKey: 'action.order_type',
            fieldPath: 'actions[action-1].params.orderType',
            status: 'open',
            priority: 'behavior',
            affectsExecution: true,
            questionHint: '请确认订单类型。',
          },
        ],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [
            {
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: { value: 100, asset: 'USDT' },
            },
          ],
          requires: [
            { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0].openSlots).toEqual([
      {
        slotKey: 'action.order_type',
        fieldPath: 'actions[action-1].params.orderType',
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '请确认订单类型。',
      },
    ])
  })

  it('locks an open owner when satisfied contract requirements leave no open slots', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-grid-levels',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 100, upper: 110, gridCount: 10 },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.price.define.level_set',
          fieldPath: 'actions[action-1].contracts[action-contract-1].requires.price.define.level_set',
          status: 'open',
          priority: 'behavior',
          affectsExecution: true,
          questionHint: '请补充 price define level_set 的执行语义。',
        }],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps fixed-range level-set requirements missing and opens the provider density slot when density is absent', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-grid-levels',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 100, upper: 110 },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(result.state.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.density',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('opens the provider spacing conflict slot when grid count and absolute spacing disagree', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-grid-levels',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 100, upper: 110, gridCount: 10, absoluteSpacing: 1 },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('accepts absolute-spacing fixed-range level-set capabilities for grid contracts', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-grid-levels',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 100, upper: 110, absoluteSpacing: 1 },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.price.define.level_set',
          fieldPath: 'actions[action-1].contracts[action-contract-1].requires.price.define.level_set',
          status: 'open',
          priority: 'behavior',
          affectsExecution: true,
          questionHint: '请补充 price define level_set 的执行语义。',
        }],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps known requirements missing when matching capabilities have unusable shapes', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-grid-levels',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { answer: '用户说了价格区间但没结构化' },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      })],
    }))
  })

  it('accepts centered dynamic level-set capabilities for grid contracts', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.price.define.level_set',
          fieldPath: 'actions[action-1].contracts[action-contract-1].requires.price.define.level_set',
          status: 'open',
          priority: 'behavior',
          affectsExecution: true,
          questionHint: '请确认网格区间中心价格取值方式。',
        }],
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: {
              mode: 'centered_percent_range',
              centerTiming: 'deployment',
              centerSource: 'trade_vwap',
              aggregationWindow: '1m',
              halfRangePct: 0.4,
              gridCount: 10,
            },
          }],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('accepts structured boundary cancel guard capabilities', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-boundary-stop',
        key: 'risk.boundary_guard',
        status: 'locked',
        source: 'derived',
        openSlots: [{
          slotKey: 'contract.requirement.guard.enforce.boundary_cancel',
          fieldPath: 'risk[risk-boundary-stop].contracts[risk-contract-boundary-stop].requires.guard.enforce.boundary_cancel',
          status: 'open',
          priority: 'risk',
          affectsExecution: true,
          questionHint: '请确认突破上下边界后的停止与撤单语义。',
        }],
        params: {},
        contracts: [{
          id: 'risk-contract-boundary-stop',
          kind: 'risk',
          capabilities: [{
            domain: 'guard',
            verb: 'enforce',
            object: 'boundary_cancel',
            shape: {
              onBreach: 'CANCEL_ORDER_PROGRAMS',
              cancelOrders: true,
              cancelScope: 'unfilled_grid_limit_orders',
              orderTypeScope: 'limit',
              programScope: 'grid',
              includeFilledOrders: false,
              includeOtherOrderTypes: false,
            },
          }],
          requires: [
            { domain: 'guard', verb: 'enforce', object: 'boundary_cancel' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.risk[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps boundary cancel guard requirements missing when matching capabilities have unusable shapes', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-boundary-stop',
        key: 'risk.boundary_guard',
        status: 'locked',
        source: 'derived',
        openSlots: [],
        params: {},
        contracts: [{
          id: 'risk-contract-boundary-stop',
          kind: 'risk',
          capabilities: [{
            domain: 'guard',
            verb: 'enforce',
            object: 'boundary_cancel',
            shape: { answer: '用户确认了撤单范围但没结构化' },
          }],
          requires: [
            { domain: 'guard', verb: 'enforce', object: 'boundary_cancel' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'risk',
        ownerId: 'risk-boundary-stop',
        contractId: 'risk-contract-boundary-stop',
        domain: 'guard',
        verb: 'enforce',
        object: 'boundary_cancel',
      },
    ])
    expect(result.state.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.requirement.guard.enforce.boundary_cancel',
      })],
    }))
  })

  it('opens locked owners when stale non-contract slots remain open', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        openSlots: [{
          slotKey: 'action.order_type',
          fieldPath: 'actions[action-1].params.orderType',
          status: 'open',
          priority: 'behavior',
          affectsExecution: true,
          questionHint: '请确认订单类型。',
        }],
        contracts: [],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
      })],
    }))
  })

  it('does not use open atom capabilities to satisfy contract requirements', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-open-provider',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'open',
        source: 'derived',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-open',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 100, upper: 110, gridCount: 10 },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('keeps owner context when active atoms reuse the same contract id', () => {
    const state = createSemanticState({
      actions: [
        {
          id: 'action-1',
          key: 'action.grid_ladder',
          status: 'open',
          source: 'derived',
          contracts: [{
            id: 'shared-contract',
            kind: 'action',
            capabilities: [],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
            ],
            params: {},
          }],
        },
        {
          id: 'action-2',
          key: 'action.grid_ladder',
          status: 'open',
          source: 'derived',
          contracts: [{
            id: 'shared-contract',
            kind: 'action',
            capabilities: [],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
            ],
            params: {},
          }],
        },
      ],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'shared-contract',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
      {
        ownerKind: 'action',
        ownerId: 'action-2',
        contractId: 'shared-contract',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
        fieldPath: 'actions[action-1].contracts[shared-contract].requires.price.define.level_set',
      }),
    ])
    expect(result.state.actions[1].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
        fieldPath: 'actions[action-2].contracts[shared-contract].requires.price.define.level_set',
      }),
    ])
  })

  it('ignores contracts on superseded atoms', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-superseded',
        key: 'action.grid_ladder',
        status: 'superseded',
        source: 'derived',
        contracts: [{
          id: 'action-contract-superseded',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0].openSlots).toBeUndefined()
  })
})

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
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
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-03T00:00:00.000Z',
    ...overrides,
  }
}
