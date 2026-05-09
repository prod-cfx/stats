import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'

describe('SemanticContractReadinessService', () => {
  it('accepts supported contracts with explicit empty substrate arrays', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-1',
        key: 'condition.expression',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'trigger-contract-1',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
  })

  it('accepts action owners without an openSlots array', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-without-open-slots',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        contracts: [{
          id: 'action-contract-without-open-slots',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.state.actions[0].openSlots).toBeUndefined()
  })

  it('keeps executable indicator above and below MA aliases supported during readiness', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-price-above-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'moving_average',
          'reference.period': 100,
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-price-above-ma',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }, {
        id: 'trigger-price-below-ema',
        key: 'indicator.below',
        phase: 'exit',
        params: {
          indicator: 'ema',
          referenceRole: 'moving_average',
          'reference.period': 50,
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-price-below-ema',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [{
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'action-contract-open-long',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.triggers[0].openSlots).toEqual([])
    expect(result.state.triggers[1].openSlots).toEqual([])
  })

  it('accepts known runtime state and order requirements', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-cross-over',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'trigger-contract-cross-over',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [
            { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
            { domain: 'runtime', verb: 'provide', object: 'indicator_helper', shape: { name: 'sma' } },
          ],
          stateRequirements: [],
          orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.triggers[0].openSlots).toEqual([])
  })

  it('fails closed on unknown runtime state and order requirements', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-grid-ladder',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'action-contract-grid-ladder',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'orderbook_depth' }],
          stateRequirements: [{ domain: 'state', verb: 'write', object: 'grid_anchor' }],
          orderRequirements: [{ domain: 'order', verb: 'support', object: 'cancel_replace_ladder' }],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [
        expect.objectContaining({
          slotKey: 'contract.runtime_requirement.runtime.provide.orderbook_depth',
          priority: 'behavior',
          affectsExecution: true,
          status: 'open',
        }),
        expect.objectContaining({
          slotKey: 'contract.state_requirement.state.write.grid_anchor',
          priority: 'behavior',
          affectsExecution: true,
          status: 'open',
        }),
        expect.objectContaining({
          slotKey: 'contract.order_requirement.order.support.cancel_replace_ladder',
          priority: 'risk',
          affectsExecution: true,
          status: 'open',
        }),
      ],
    }))
  })

  it('fails supported owners whose contracts omit substrate arrays', () => {
    const legacyContract = {
      id: 'legacy-trigger-contract',
      kind: 'trigger',
      capabilities: [],
      requires: [],
      params: {},
    } as never
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-legacy',
        key: 'condition.expression',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [legacyContract],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.substrate.missing',
        fieldPath: 'triggers[trigger-legacy].contracts[legacy-trigger-contract]',
        affectsExecution: true,
        status: 'open',
      })],
    }))
  })

  it('merges execution-affecting contract open slots into the owner', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-falling-knife',
        key: 'risk.falling_knife_guard',
        status: 'locked',
        source: 'derived',
        params: {},
        openSlots: [],
        support: { supportStatus: 'supported_requires_slot' },
        contracts: [{
          id: 'risk-contract-falling-knife',
          kind: 'risk',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [{
            slotKey: 'risk.falling_knife_guard.definition',
            fieldPath: 'risk[risk-falling-knife].params.definition',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认“不接飞刀”的判定方式。',
            affectsExecution: true,
          }],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
        affectsExecution: true,
        status: 'open',
      })],
    }))
  })

  it('preserves answered contract-declared owner open slots during readiness normalization', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-falling-knife',
        key: 'risk.falling_knife_guard',
        status: 'locked',
        source: 'derived',
        params: {},
        openSlots: [{
          slotKey: 'risk.falling_knife_guard.definition',
          fieldPath: 'risk[risk-falling-knife].params.definition',
          value: '反弹站上 MA20 后才允许开仓',
          status: 'locked',
          priority: 'risk',
          questionHint: '请确认“不接飞刀”的判定方式。',
          affectsExecution: true,
          evidence: {
            source: 'user_explicit',
            text: '反弹站上 MA20 后才允许开仓',
          },
        }],
        support: { supportStatus: 'supported_requires_slot' },
        contracts: [{
          id: 'risk-contract-falling-knife',
          kind: 'risk',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [{
            slotKey: 'risk.falling_knife_guard.definition',
            fieldPath: 'risk[risk-falling-knife].params.definition',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认“不接飞刀”的判定方式。',
            affectsExecution: true,
            evidence: {
              source: 'derived',
              text: 'Missing falling knife definition',
            },
          }],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.state.risk[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [{
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk[risk-falling-knife].params.definition',
        value: '反弹站上 MA20 后才允许开仓',
        status: 'locked',
        priority: 'risk',
        questionHint: '请确认“不接飞刀”的判定方式。',
        affectsExecution: true,
        evidence: {
          source: 'user_explicit',
          text: '反弹站上 MA20 后才允许开仓',
        },
      }],
    }))
  })

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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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

  it('keeps recognized unsupported contracts out of readiness open slots', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-atr-stop',
        key: 'risk.atr_stop',
        params: { atrPeriod: 14, multiplier: 2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: {
          supportStatus: 'recognized_unsupported',
          unsupportedReasonCode: 'atr_stop_public_beta_unsupported',
          unsupportedDisplayName: 'ATR 动态止损',
        },
        contracts: [{
          id: 'risk-contract-atr-stop',
          kind: 'risk',
          capabilities: [],
          requires: [
            { domain: 'market', verb: 'read', object: 'latest_bar' },
            { domain: 'guard', verb: 'enforce', object: 'atr_stop' },
          ],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.risk[0].openSlots).toEqual([])
  })

  it('keeps unknown contracts out of readiness open slots', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-unknown',
        key: 'custom.volume.delta',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'unsupported_unknown' },
        contracts: [{
          id: 'trigger-contract-unknown',
          kind: 'trigger',
          capabilities: [],
          requires: [
            { domain: 'market', verb: 'read', object: 'order_flow_delta' },
          ],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.triggers[0].openSlots).toEqual([])
  })

  it('does not let stale unsupported metadata block currently supported registry atoms', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-supported',
        key: 'grid.price_levels',
        phase: 'gate',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        support: {
          supportStatus: 'recognized_unsupported',
          unsupportedReasonCode: 'old_grid_unsupported',
          unsupportedDisplayName: '旧网格元数据',
        },
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        openSlots: [],
        support: { supportStatus: 'unsupported_unknown' },
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
          ],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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

  it('keeps unregistered contracts without support metadata out of readiness open slots', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-unregistered',
        key: 'custom.unregistered.contract',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-unregistered',
          kind: 'trigger',
          capabilities: [],
          requires: [
            { domain: 'market', verb: 'read', object: 'latest_bar' },
          ],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.triggers[0].openSlots).toEqual([])
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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

  it('keeps provider density slots stable across repeated readiness normalization', () => {
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })
    const service = new SemanticContractReadinessService()

    const first = service.normalize(state)
    const second = service.normalize(first.state)

    expect(second.ready).toBe(false)
    expect(second.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(second.state.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.density',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(second.state.actions[0].openSlots).toEqual([
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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

  it('keeps provider spacing conflict slots stable across repeated readiness normalization', () => {
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })
    const service = new SemanticContractReadinessService()

    const first = service.normalize(state)
    const second = service.normalize(first.state)

    expect(second.ready).toBe(false)
    expect(second.missingRequirements).toEqual([
      {
        ownerKind: 'action',
        ownerId: 'action-1',
        contractId: 'action-contract-1',
        domain: 'price',
        verb: 'define',
        object: 'level_set',
      },
    ])
    expect(second.state.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(second.state.actions[0].openSlots).toEqual([
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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

  it('keeps execution-affecting action owner open slots blocking readiness', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
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

    expect(result.ready).toBe(false)
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
        affectsExecution: true,
      }),
    ])
  })

  it('does not block readiness on display-only action owner open slots', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'action.display_hint',
          fieldPath: 'actions[action-1].displayHint',
          status: 'open',
          priority: 'behavior',
          affectsExecution: false,
          questionHint: '展示提示。',
        }],
        contracts: [],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.display_hint',
        status: 'open',
        affectsExecution: false,
      }),
    ])
  })

  it('keeps trigger risk and position owner open slots blocking readiness', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-dip',
        key: 'price.percent_change',
        phase: 'gate',
        params: { direction: 'down' },
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'trigger.percent_change.magnitude',
          fieldPath: 'triggers[price.percent_change].params.valuePct',
          status: 'open',
          priority: 'core',
          questionHint: '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
          affectsExecution: true,
        }],
        contracts: [{
          id: 'trigger-contract-dip',
          kind: 'trigger',
          capabilities: [{
            domain: 'market',
            verb: 'read',
            object: 'latest_bar',
            shape: {},
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      risk: [{
        id: 'risk-falling-knife',
        key: 'risk.falling_knife_guard',
        status: 'open',
        source: 'user_explicit',
        params: {},
        openSlots: [{
          slotKey: 'risk.falling_knife_guard.definition',
          fieldPath: 'risk.params.definition',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
          affectsExecution: true,
        }],
        contracts: [{
          id: 'risk-contract-falling-knife',
          kind: 'risk',
          capabilities: [{
            domain: 'guard',
            verb: 'enforce',
            object: 'falling_knife',
            shape: {},
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
        mode: 'fixed_ratio',
        value: 0,
        sizing: null,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'position.sizing',
          fieldPath: 'position.sizing',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
          affectsExecution: true,
        }],
        contracts: [{
          id: 'position-contract-sizing',
          kind: 'position',
          capabilities: [{
            domain: 'exposure',
            verb: 'set',
            object: 'position_mode',
            shape: { mode: 'long_only' },
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

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.triggers[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'trigger.percent_change.magnitude',
        fieldPath: 'triggers[price.percent_change].params.valuePct',
      }),
    ])
    expect(result.state.risk[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk.params.definition',
      }),
    ])
    expect(result.state.position?.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
      }),
    ])
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
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
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.actions[0].openSlots).toBeUndefined()
  })

  it('blocks locked orchestration nodes because Phase 0 has no orchestration runtime', () => {
    const state = createSemanticState({
      orchestration: {
        nodes: [{
          id: 'scope-1',
          kind: 'scope',
          status: 'locked',
          source: 'user_explicit',
          params: { symbol: 'BTCUSDT' },
          openSlots: [],
          contracts: [{
            id: 'scope-contract-1',
            kind: 'scope',
            params: {},
            capabilities: [],
            requires: [],
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        contracts: [],
      },
    })

    const result = new SemanticContractReadinessService().normalize(state)
    const openSlots = result.state.orchestration?.nodes[0].openSlots

    expect(result.ready).toBe(false)
    expect(result.state.orchestration?.contracts).toEqual([])
    expect(openSlots).toContainEqual(
      expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
        affectsExecution: true,
        status: 'open',
      }),
    )
  })

  it('does not block draft orchestration nodes that are still open', () => {
    const state = createSemanticState({
      orchestration: {
        nodes: [{
          id: 'scope-1',
          kind: 'scope',
          status: 'open',
          source: 'user_explicit',
          params: { symbol: 'BTCUSDT' },
          openSlots: [{
            slotKey: 'orchestration.scope.symbol',
            fieldPath: 'orchestration.scope[scope-1].params.symbol',
            status: 'open',
            priority: 'core',
            questionHint: '请选择 orchestration scope symbol。',
            affectsExecution: true,
          }],
          contracts: [{
            id: 'scope-contract-1',
            kind: 'scope',
            params: {},
            capabilities: [],
            requires: [],
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        contracts: [],
      },
    })

    const result = new SemanticContractReadinessService().normalize(state)
    const openSlots = result.state.orchestration?.nodes[0].openSlots

    expect(result.ready).toBe(false)
    expect(result.state.orchestration?.contracts).toEqual([])
    expect(openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'orchestration.scope.symbol',
        affectsExecution: true,
        status: 'open',
      }),
    ])
    expect(openSlots).not.toContainEqual(expect.objectContaining({
      slotKey: 'orchestration.phase0.unsupported',
    }))
  })

  describe('orchestration gate.regime supported gate (Phase 5 S1)', () => {
    const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

    function regimeGateNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
      return {
        id: 'gate-regime-1',
        kind: 'gate',
        key: 'gate.regime',
        status: 'locked',
        source: 'user_explicit',
        params: {},
        target: { phase: 'entry' },
        activeWhen: {
          kind: 'predicate',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'constant', value: 0 },
        } as unknown as SemanticOrchestrationNode['activeWhen'],
        openSlots: [],
        contracts: [],
        ...overrides,
      }
    }

    it('Test A: gate.regime + activeWhen valid + 新策略 → readiness 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode()], contracts: [] },
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const node = result.state.orchestration?.nodes[0]

      expect(node?.status).toBe('locked')
      expect(node?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
      expect(node?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.gate.regime.active_when',
      }))
    })

    it('Test B: gate.regime + activeWhen valid + 老策略 (deployedAtSemanticVersion=null) → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode()], contracts: [] },
      })

      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = new SemanticContractReadinessService().normalize(state, legacy)
      const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test C: gate.regime + activeWhen 缺失 → registry 驱动 active_when open slot，无 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({ activeWhen: undefined })],
          contracts: [],
        },
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.gate.regime.active_when',
      }))
      expect(openSlots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test D: kind=gate + key=未知 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({ key: 'unknown_gate_atom' })],
          contracts: [],
        },
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test E: gate.regime + target.phase !== entry → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({ target: undefined })],
          contracts: [],
        },
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test F: gate.regime + activeWhen 不是表达式对象 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({
            activeWhen: 'close > 0' as unknown as SemanticOrchestrationNode['activeWhen'],
          })],
          contracts: [],
        },
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test G: kind in {scope, program, portfolioRisk} → fail-closed 走 phase0（回归保留）', () => {
      const kinds: Array<'scope' | 'program' | 'portfolioRisk'> = ['scope', 'program', 'portfolioRisk']
      for (const kind of kinds) {
        const state = createSemanticState({
          orchestration: {
            nodes: [{
              id: `${kind}-node`,
              kind,
              status: 'locked',
              source: 'user_explicit',
              params: {},
              openSlots: [],
              contracts: [],
            }],
            contracts: [],
          },
        })

        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const openSlots = result.state.orchestration?.nodes[0].openSlots ?? []

        expect(openSlots).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })
  })
})

describe('SemanticContractReadinessService timeframe pairing', () => {
  const baseAction = {
    id: 'action-open-long',
    key: 'open_long',
    status: 'locked' as const,
    source: 'user_explicit' as const,
    openSlots: [],
    contracts: [{
      id: 'action-contract-open-long',
      kind: 'action' as const,
      capabilities: [],
      requires: [],
      params: {},
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }],
  }

  function timeframeSlot(value: string) {
    return {
      slotKey: 'context.timeframe',
      fieldPath: 'contextSlots.timeframe',
      value,
      status: 'locked' as const,
      priority: 'core' as const,
      affectsExecution: true,
      questionHint: '',
    }
  }

  it('reports ready=true when trigger timeframe aligns with execution context timeframe', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('1h'),
      },
      triggers: [{
        id: 'trigger-aligned',
        key: 'indicator.above',
        phase: 'entry',
        params: { timeframe: '1h', indicator: 'ma', referenceRole: 'moving_average', 'reference.period': 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-aligned',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
  })

  it('reports timeframe mismatch when trigger timeframe differs from execution context', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('1h'),
      },
      triggers: [{
        id: 'trigger-misaligned',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { timeframe: '4h' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-misaligned',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    const mismatches = result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]).toMatchObject({
      kind: 'timeframe_mismatch',
      errorCode: 'READINESS_TIMEFRAME_MISMATCH',
      ownerKind: 'trigger',
      ownerId: 'trigger-misaligned',
      producer: { ownerKind: 'trigger', ownerId: 'trigger-misaligned', timeframe: '4h' },
      consumer: { source: 'context_slot', timeframe: '1h' },
    })
    expect(result.state.triggers[0].openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'contract.timeframe_mismatch.trigger.trigger-misaligned',
        affectsExecution: true,
        status: 'open',
      }),
    ]))
  })

  it('reports every misaligned indicator across multiple triggers', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('1h'),
      },
      triggers: [{
        id: 'trigger-aligned',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { timeframe: '1h' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-aligned',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }, {
        id: 'trigger-misaligned-a',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { timeframe: '4h' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-misaligned-a',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }, {
        id: 'trigger-misaligned-b',
        key: 'indicator.cross_over',
        phase: 'exit',
        params: { timeframe: '15m' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-misaligned-b',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    const mismatches = result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')
    expect(mismatches.map(m => m.ownerId).sort()).toEqual(['trigger-misaligned-a', 'trigger-misaligned-b'])
  })

  it('does not raise timeframe mismatch when execution context timeframe is missing', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-no-context',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { timeframe: '4h' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-no-context',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
  })

  it('honors explicit timeframeOverride and skips mismatch reporting', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('1h'),
      },
      triggers: [{
        id: 'trigger-override',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { timeframe: '4h', timeframeOverride: true },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-override',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
    expect(result.ready).toBe(true)
  })

  it('skips timeframe mismatch for indicator.above HTF filter trigger with timeframeOverride', () => {
    // 执行 TF=15m，HTF filter trigger 使用 1h EMA，带 timeframeOverride=true，应豁免
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('15m'),
      },
      triggers: [{
        id: 'trigger-htf-above',
        key: 'indicator.above',
        phase: 'entry',
        params: { indicator: 'ema', 'reference.period': 200, timeframe: '1h', timeframeOverride: true },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-htf-above',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    // 核心断言：timeframe_mismatch 被豁免（timeframeOverride=true）
    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
  })

  it('skips timeframe mismatch for indicator.below HTF filter trigger with timeframeOverride', () => {
    // 执行 TF=15m，HTF filter 使用 1h MA50 跌破，带 timeframeOverride=true，应豁免
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('15m'),
      },
      triggers: [{
        id: 'trigger-htf-below',
        key: 'indicator.below',
        phase: 'exit',
        params: { indicator: 'ma', 'reference.period': 50, timeframe: '1h', timeframeOverride: true },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'trigger-contract-htf-below',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    // 核心断言：timeframe_mismatch 被豁免（timeframeOverride=true）
    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
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
