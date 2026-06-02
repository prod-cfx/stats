import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'

describe('SemanticContractReadinessService', () => {
  it('projects top-level sizing into program rule before dropping standalone sizing rules', () => {
    const state = createSemanticState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: { slotKey: 'context.exchange', status: 'locked', value: 'okx', source: 'user_explicit' },
        symbol: { slotKey: 'context.symbol', status: 'locked', value: 'BTCUSDT', source: 'user_explicit' },
        marketType: { slotKey: 'context.marketType', status: 'locked', value: 'perp', source: 'user_explicit' },
        timeframe: { slotKey: 'context.timeframe', status: 'locked', value: '15m', source: 'user_explicit' },
      },
      rules: [
        {
          id: 'program-fixed-grid',
          phase: 'program',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'grid.range_rebalance',
            params: { sideMode: 'both' },
          },
          effects: {
            actions: [],
            risks: [],
            positions: [{ kind: 'atom', key: 'grid.range_rebalance', params: { sideMode: 'both' } }],
            orchestration: [],
            programs: [{ kind: 'atom', key: 'program.fixed_grid_gated', params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5 } }],
          },
        },
        {
          id: 'pos-sizing-10pct',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'execution.on_start', params: {} },
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

    const result = new SemanticContractReadinessService().normalize(state, { deployedAtSemanticVersion: '2026.05.W02' })
    const programRule = result.state.rules?.find(rule => rule.id === 'program-fixed-grid')

    expect(result.ready).toBe(true)
    expect(result.state.rules?.map(rule => rule.id)).toEqual(['program-fixed-grid'])
    expect(programRule?.effects).toEqual(expect.objectContaining({
      positions: expect.arrayContaining([
        expect.objectContaining({ key: 'position.sizing' }),
      ]),
    }))
  })

  it('accepts rules-first fixed grid with duplicated same-timeframe scopes', () => {
    const state = createSemanticState({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: { slotKey: 'context.exchange', status: 'locked', value: 'okx', source: 'user_explicit' },
        symbol: { slotKey: 'context.symbol', status: 'locked', value: 'BTCUSDT', source: 'user_explicit' },
        marketType: { slotKey: 'context.marketType', status: 'locked', value: 'perp', source: 'user_explicit' },
        timeframe: { slotKey: 'context.timeframe', status: 'locked', value: '15m', source: 'user_explicit' },
      },
      rules: [
        {
          id: 'dispatcher-typed-rule-1',
          phase: 'gate',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'trend.direction', params: { value: 'up' } },
          effects: {
            actions: [],
            risks: [],
            positions: [],
            programs: [],
            orchestration: [{
              kind: 'atom',
              key: 'scope.timeframe',
              params: { primaryTimeframe: '15m', requiredTimeframes: ['15m'], alignmentPolicy: 'tolerant', timeframeScopeKind: 'timeframe' },
            }],
          },
        },
        {
          id: 'program-fixed-grid-range-50000-60000-10-5pct',
          phase: 'program',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'grid.range_rebalance',
            params: { rangeLower: 50000, rangeUpper: 60000, levels: 10, stepPct: 5, sideMode: 'both', breakoutAction: 'continue' },
          },
          effects: {
            actions: [],
            risks: [],
            positions: [
              { kind: 'atom', key: 'grid.range_rebalance', params: { sideMode: 'both', recycle: 'true' } },
              { kind: 'atom', key: 'position.sizing', params: { sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 } } },
            ],
            programs: [
              { kind: 'atom', key: 'program.fixed_grid_gated', params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5, programKind: 'fixed_grid_gated', onDeactivate: 'cancel' } },
            ],
            orchestration: [{
              kind: 'atom',
              key: 'scope.timeframe',
              params: { primaryTimeframe: '15m', requiredTimeframes: ['15m'], alignmentPolicy: 'tolerant', timeframeScopeKind: 'timeframe' },
            }],
          },
        },
      ],
    })

    const result = new SemanticContractReadinessService().normalize(state, { deployedAtSemanticVersion: '2026.05.W02' })

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
  })

  it('accepts rules-first funding rate condition with price crossing EMA', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: { slotKey: 'context.exchange', status: 'locked', value: 'okx', source: 'user_explicit' },
        symbol: { slotKey: 'context.symbol', status: 'locked', value: 'BTCUSDT', source: 'user_explicit' },
        marketType: { slotKey: 'context.marketType', status: 'locked', value: 'perp', source: 'user_explicit' },
        timeframe: { slotKey: 'context.timeframe', status: 'locked', value: '15m', source: 'user_explicit' },
      },
      rules: [
        {
          id: 'entry-long-funding-positive-ema20-crossup',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'and',
            children: [
              { kind: 'atom', key: 'fundingRate.condition', params: { operator: 'GT', value: 0, threshold: 0, dataSource: 'funding' } },
              { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ema', period: 20, fastPeriod: 20, priceCross: true } },
            ],
          },
          effects: {
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [],
            positions: [{ kind: 'atom', key: 'position.sizing', params: { sizing: { kind: 'ratio', unit: 'ratio', value: 0.01 } } }],
            programs: [],
            orchestration: [],
          },
        },
        {
          id: 'exit-close-long-ema20-crossdown',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ema', period: 20, fastPeriod: 20, priceCross: true } },
          effects: {
            actions: [{ kind: 'atom', key: 'action.close_long', params: {} }],
            risks: [],
            positions: [],
            programs: [],
            orchestration: [],
          },
        },
      ],
    })

    const result = new SemanticContractReadinessService().normalize(state, { deployedAtSemanticVersion: '2026.05.W02' })

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
  })

  it('accepts supported contracts with explicit empty substrate arrays', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
      action: [{
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
    expect(result.state.action[0].openSlots).toBeUndefined()
  })

  it('does not reopen add-position constraint when top-level positionConstraint already covers it', () => {
    const state = createSemanticState({
      action: [{
        id: 'add-position',
        key: 'action.add_position',
        params: {
          addMode: 'drawdown_pct',
          sideScope: 'long',
          constraint: '最多加 1 次，最大总敞口 300 USDT。',
          drawdownThreshold: 5,
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      positionConstraint: [{
        id: 'pyramiding-limit',
        key: 'position.pyramiding_limit',
        params: { maxLayers: 1 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.state.action[0].openSlots ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'action.add_position.constraint', status: 'open' }),
    ]))
  })

  it('keeps executable indicator above and below MA aliases supported during readiness', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.trigger[0].openSlots).toEqual([])
    expect(result.state.trigger[1].openSlots).toEqual([])
  })

  it('accepts known runtime state and order requirements', () => {
    const state = createSemanticState({
      trigger: [{
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
    expect(result.state.trigger[0].openSlots).toEqual([])
  })

  it('accepts state.read_write.program_lifecycle (Phase 5 S0a substrate)', () => {
    const state = createSemanticState({
      trigger: [{
        id: 'trigger-program-lifecycle',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'trigger-contract-program-lifecycle',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [
            { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
          ],
          stateRequirements: [
            { domain: 'state', verb: 'read_write', object: 'program_lifecycle' },
          ],
          orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
    expect(result.state.trigger[0].openSlots).toEqual([])
  })

  it('fails closed on unknown runtime state and order requirements', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
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
      trigger: [{
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
    expect(result.state.trigger[0]).toEqual(expect.objectContaining({
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
      action: [{
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
        // #1186 PR3: per_order_budget missing entries 一律携带 READINESS_PER_ORDER_BUDGET_MISSING
        errorCode: 'READINESS_PER_ORDER_BUDGET_MISSING',
      },
    ])
    expect(result.state.action[0].openSlots).toEqual([
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
    // Issue #1383 Lane A：risk.atr_stop 已升级为 supported_executable，
    //   readiness service 走 isSupportedAtom 短路；改用仍为 recognized_unsupported
    //   的 volume.spike 验证未支持原子的 contract requirements 不进入 open slots。
    const state = createSemanticState({
      trigger: [{
        id: 'trigger-volume-spike',
        key: 'volume.spike',
        phase: 'entry',
        params: { multiplier: 2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: {
          supportStatus: 'recognized_unsupported',
          unsupportedReasonCode: 'volume_condition_public_beta_unsupported',
          unsupportedDisplayName: '成交量放大',
        },
        contracts: [{
          id: 'trigger-contract-volume-spike',
          kind: 'trigger',
          capabilities: [],
          requires: [
            { domain: 'market', verb: 'read', object: 'latest_bar' },
            { domain: 'guard', verb: 'enforce', object: 'volume_spike' },
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
    expect(result.state.trigger[0].openSlots).toEqual([])
  })

  it('keeps unknown contracts out of readiness open slots', () => {
    const state = createSemanticState({
      trigger: [{
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
    expect(result.state.trigger[0].openSlots).toEqual([])
  })

  it('does not let stale unsupported metadata block currently supported registry atoms', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps unregistered contracts without support metadata out of readiness open slots', () => {
    const state = createSemanticState({
      trigger: [{
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
    expect(result.state.trigger[0].openSlots).toEqual([])
  })

  it('does not duplicate existing open slots and preserves the original question hint', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toHaveLength(1)
    expect(result.state.action[0].openSlots?.[0]).toEqual(expect.objectContaining({
      questionHint: '原始问题提示',
      value: null,
    }))
  })

  it('reopens answered contract requirement slots when the capability is still missing', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toHaveLength(1)
    expect(result.state.action[0].openSlots?.[0]).toEqual({
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
    expect(result.state.action[0].openSlots?.filter(slot => slot.status === 'open')).toHaveLength(1)
  })

  it('clears stale contract requirement slots when the capability becomes satisfied', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toEqual([
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
      trigger: [{
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
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps fixed-range level-set requirements missing and opens the provider density slot when density is absent', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'grid.range_rebalance.levels',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'levels',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('keeps provider density slots stable across repeated readiness normalization', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(second.state.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'grid.range_rebalance.levels',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'levels',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(second.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('opens the provider spacing conflict slot when grid count and absolute spacing disagree', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'grid.range_rebalance.stepPct',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'stepPct',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('keeps provider spacing conflict slots stable across repeated readiness normalization', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(second.state.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'grid.range_rebalance.stepPct',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'stepPct',
        fieldPath: 'triggers[trigger-grid-levels].contracts[trigger-contract-levels].capabilities[price.define.level_set].shape',
      })],
    }))
    expect(second.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('accepts absolute-spacing fixed-range level-set capabilities for grid contracts', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
  })

  it('keeps known requirements missing when matching capabilities have unusable shapes', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      })],
    }))
  })

  it('accepts centered dynamic level-set capabilities for grid contracts', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0]).toEqual(expect.objectContaining({
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
      action: [{
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

    expect(result.state.action[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
      })],
    }))
  })

  it('keeps execution-affecting action owner open slots blocking readiness', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
        affectsExecution: true,
      }),
    ])
  })

  it('does not block readiness on display-only action owner open slots', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.display_hint',
        status: 'open',
        affectsExecution: false,
      }),
    ])
  })

  it('keeps trigger risk and position owner open slots blocking readiness', () => {
    const state = createSemanticState({
      trigger: [{
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
    expect(result.state.trigger[0].openSlots).toEqual([
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
      trigger: [{
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
      action: [{
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
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ])
  })

  it('keeps owner context when active atoms reuse the same contract id', () => {
    const state = createSemanticState({
      action: [
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
    expect(result.state.action[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
        fieldPath: 'actions[action-1].contracts[shared-contract].requires.price.define.level_set',
      }),
    ])
    expect(result.state.action[1].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.requirement.price.define.level_set',
        fieldPath: 'actions[action-2].contracts[shared-contract].requires.price.define.level_set',
      }),
    ])
  })

  it('ignores contracts on superseded atoms', () => {
    const state = createSemanticState({
      action: [{
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
    expect(result.state.action[0].openSlots).toBeUndefined()
  })

  it('blocks locked orchestration nodes because Phase 0 has no orchestration runtime', () => {
    const state = createSemanticState({
      orchestration: [{
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
      orchestrationContracts: [],
    })

    const result = new SemanticContractReadinessService().normalize(state)
    const openSlots = result.state.orchestration[0].openSlots

    expect(result.ready).toBe(false)
    expect(result.state.orchestrationContracts).toEqual([])
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
      orchestration: [{
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
      orchestrationContracts: [],
    })

    const result = new SemanticContractReadinessService().normalize(state)
    const openSlots = result.state.orchestration[0].openSlots

    expect(result.ready).toBe(false)
    expect(result.state.orchestrationContracts).toEqual([])
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
        orchestration: [regimeGateNode()], orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const node = result.state.orchestration[0]

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
        orchestration: [regimeGateNode()], orchestrationContracts: [],
      })

      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = new SemanticContractReadinessService().normalize(state, legacy)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test C: gate.regime + activeWhen 缺失 → registry 驱动 active_when open slot，无 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode({ activeWhen: undefined })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.gate.regime.active_when',
      }))
      expect(openSlots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test D: kind=gate + key=未知 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode({ key: 'unknown_gate_atom' })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test E: gate.regime + target.phase !== entry → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode({ target: undefined })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test F: gate.regime + activeWhen 不是表达式对象 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode({
            activeWhen: 'close > 0' as unknown as SemanticOrchestrationNode['activeWhen'],
          })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test G: kind in {scope, program, portfolioRisk} → fail-closed 走 phase0（回归保留）', () => {
      const kinds: Array<'scope' | 'program' | 'portfolioRisk'> = ['scope', 'program', 'portfolioRisk']
      for (const kind of kinds) {
        const state = createSemanticState({
          orchestration: [{
              id: `${kind}-node`,
              kind,
              status: 'locked',
              source: 'user_explicit',
              params: {},
              openSlots: [],
              contracts: [],
            }],
            orchestrationContracts: [],
        })

        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const openSlots = result.state.orchestration[0].openSlots ?? []

        expect(openSlots).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })
  })

  describe('orchestration portfolioRisk.drawdown_block supported (Phase 5 S7)', () => {
    const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

    function drawdownBlockNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
      return {
        id: 'pr-drawdown-1',
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
        status: 'locked',
        source: 'user_explicit',
        params: {},
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
        openSlots: [],
        contracts: [],
        ...overrides,
      }
    }

    it('Test A: portfolioRisk.drawdown_block + 完整字段 + 新策略 → 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode()], orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const node = result.state.orchestration[0]

      expect(node?.status).toBe('locked')
      expect(node?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
      expect(node?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.portfolio_drawdown.threshold_pct',
      }))
    })

    it('Test B: portfolioRisk.drawdown_block + thresholdPct 缺失 → registry 驱动 threshold_pct open slot，无 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode({ thresholdPct: undefined })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.portfolio_drawdown.threshold_pct',
      }))
      expect(openSlots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test C: kind=portfolioRisk + key=未知 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode({ key: 'portfolioRisk.unknown' })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test D: scope !== portfolio → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode({ scope: 'symbol' as unknown as SemanticOrchestrationNode['scope'] })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test E: mode 非 observe|enforce → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode({ mode: 'reduce' as unknown as SemanticOrchestrationNode['mode'] })],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test F: thresholdPct ≤ 0 或 > 100 → fail-closed 走 phase0', () => {
      for (const bad of [0, -5, 100.01, 500]) {
        const state = createSemanticState({
          orchestration: [drawdownBlockNode({ thresholdPct: bad })],
            orchestrationContracts: [],
        })

        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const openSlots = result.state.orchestration[0].openSlots ?? []

        expect(openSlots).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('Test G: 老策略 (deployedAtSemanticVersion=null) → 双 fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [drawdownBlockNode()], orchestrationContracts: [],
      })

      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = new SemanticContractReadinessService().normalize(state, legacy)
      const openSlots = result.state.orchestration[0].openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test H: gate.regime + portfolioRisk.drawdown_block 同时存在 → 两条独立 supported 路径互不干扰', () => {
      const regimeNode: SemanticOrchestrationNode = {
        id: 'gate-regime-coexist',
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
      }
      const state = createSemanticState({
        orchestration: [regimeNode, drawdownBlockNode()],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const nodes = result.state.orchestration ?? []

      expect(nodes).toHaveLength(2)
      for (const n of nodes) {
        expect(n.status).toBe('locked')
        expect(n.openSlots ?? []).not.toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })
  })

  describe('orchestration program.fixed_grid_gated supported (Phase 5 S4 T7)', () => {
    const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

    function regimeGateNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
      return {
        id: 'gate-regime-ref',
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

    function fixedGridGatedNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
      return {
        id: 'program-grid-1',
        kind: 'program',
        key: 'program.fixed_grid_gated',
        status: 'locked',
        source: 'user_explicit',
        params: {},
        programKind: 'fixed_grid_gated',
        activeWhenRef: 'gate-regime-ref',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
        gridParams: {
          anchorPrice: 30000,
          levelCount: 10,
          stepPct: 1,
          lowerBound: 25000,
          upperBound: 35000,
        },
        sizing: { mode: 'fixed_quote', value: 100 },
        openSlots: [],
        contracts: [],
        ...overrides,
      }
    }

    it('Test A: 完整 program + valid gate ref + 新策略 → 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), fixedGridGatedNode()], orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.status).toBe('locked')
      expect(program?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test B: programKind 非 fixed_grid_gated → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode(),
            fixedGridGatedNode({ programKind: undefined }),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')
      const openSlots = program?.openSlots ?? []

      expect(openSlots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test C: onDeactivate 非法 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode(),
            fixedGridGatedNode({ onDeactivate: 'rollover' as unknown as SemanticOrchestrationNode['onDeactivate'] }),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test D: rebuildPolicy 非 static → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode(),
            fixedGridGatedNode({ rebuildPolicy: 'dynamic' as unknown as SemanticOrchestrationNode['rebuildPolicy'] }),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test E: gridParams 非法 (anchorPrice / levelCount / stepPct / lowerBound>upperBound) → fail-closed 走 phase0', () => {
      const badGrids: Array<NonNullable<SemanticOrchestrationNode['gridParams']>> = [
        { anchorPrice: 0, levelCount: 10, stepPct: 1 },
        { anchorPrice: 30000, levelCount: 1, stepPct: 1 },
        { anchorPrice: 30000, levelCount: 101, stepPct: 1 },
        { anchorPrice: 30000, levelCount: 10, stepPct: 0 },
        { anchorPrice: 30000, levelCount: 10, stepPct: 1, lowerBound: 35000, upperBound: 25000 },
      ]
      for (const grid of badGrids) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), fixedGridGatedNode({ gridParams: grid })],
            orchestrationContracts: [],
        })

        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')

        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('Test F: sizing 非法 (mode 非法 / value ≤ 0) → fail-closed 走 phase0', () => {
      const badSizings: Array<NonNullable<SemanticOrchestrationNode['sizing']>> = [
        { mode: 'unknown_mode' as unknown as 'fixed_quote', value: 100 },
        { mode: 'fixed_quote', value: 0 },
        { mode: 'fixed_pct', value: -1 },
      ]
      for (const sizing of badSizings) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), fixedGridGatedNode({ sizing })],
            orchestrationContracts: [],
        })

        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')

        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('Test G: activeWhenRef 引用不存在的节点 → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode(),
            fixedGridGatedNode({ activeWhenRef: 'no-such-id' }),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test H: activeWhenRef 引用 status:open 的 gate → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode({ status: 'open' }),
            fixedGridGatedNode(),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test I: activeWhenRef 引用 readiness fail 的 gate (target.phase 缺失) → fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [
            regimeGateNode({ target: undefined }),
            fixedGridGatedNode(),
          ],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('Test J: 老策略 (deployedAtSemanticVersion=null) → 双 fail-closed 走 phase0', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), fixedGridGatedNode()],
          orchestrationContracts: [],
      })

      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = new SemanticContractReadinessService().normalize(state, legacy)
      const program = result.state.orchestration.find(n => n.kind === 'program')

      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    // Phase 5 S6 (#984) — adaptive_volatility_grid 16 fail-closed
    function adaptiveNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
      return {
        id: 'program-adaptive-1',
        kind: 'program',
        key: 'program.adaptive_volatility_grid',
        status: 'locked',
        source: 'user_explicit',
        params: {},
        programKind: 'adaptive_volatility_grid',
        activeWhenRef: 'gate-regime-ref',
        onDeactivate: 'cancel',
        rebuildPolicy: 'atr_window',
        atrPeriod: 14,
        atrMultiplier: 1.5,
        rangeMultiplier: 3,
        atrDriftPct: 25,
        rebuildCooldownSec: 600,
        minStepPct: 0.2,
        maxStepPct: 2,
        levelCount: 6,
        sizing: { mode: 'fixed_quote', value: 100 },
        openSlots: [],
        contracts: [],
        ...overrides,
      }
    }

    it('S6 case 1 完整 adaptive + valid gate ref + 新策略 → 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), adaptiveNode()], orchestrationContracts: [],
      })
      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')
      expect(program?.status).toBe('locked')
      expect(program?.openSlots ?? []).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('S6 cases 2-5 各 16 fail-closed (key/programKind/onDeactivate/rebuildPolicy)', () => {
      const variations: Array<Partial<SemanticOrchestrationNode>> = [
        { key: 'program.unknown' },
        { programKind: 'fixed_grid_gated' },
        { onDeactivate: 'rollover' as never },
        { rebuildPolicy: 'static' },
      ]
      for (const v of variations) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode(v)], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 6 atrPeriod 越界 (1 / 201 / 非整数) → fail-closed', () => {
      for (const atrPeriod of [1, 201, 14.5]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode({ atrPeriod })], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 cases 7-8 atrMultiplier / rangeMultiplier <= 0 → fail-closed', () => {
      for (const overrides of [{ atrMultiplier: 0 }, { rangeMultiplier: -1 }, { atrMultiplier: NaN }]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode(overrides)], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 9 atrDriftPct 越界 (0 / 101) → fail-closed', () => {
      for (const atrDriftPct of [0, 101]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode({ atrDriftPct })], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 10 rebuildCooldownSec=299（硬下限 300 不达）→ fail-closed', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), adaptiveNode({ rebuildCooldownSec: 299 })], orchestrationContracts: [],
      })
      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')
      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('S6 cases 11-13 minStepPct / maxStepPct / max < min → fail-closed', () => {
      for (const overrides of [{ minStepPct: 0 }, { maxStepPct: 0 }, { minStepPct: 2, maxStepPct: 1 }]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode(overrides)], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 14 levelCount 越界 (1 / 101 / 非整数) → fail-closed', () => {
      for (const levelCount of [1, 101, 5.5]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode({ levelCount })], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 15 sizing 非法 → fail-closed', () => {
      for (const sizing of [
        { mode: 'unknown' as never, value: 100 },
        { mode: 'fixed_quote' as const, value: 0 },
      ]) {
        const state = createSemanticState({
          orchestration: [regimeGateNode(), adaptiveNode({ sizing })], orchestrationContracts: [],
        })
        const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
        const program = result.state.orchestration.find(n => n.kind === 'program')
        expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('S6 case 16a activeWhenRef 引用不存在节点 → fail-closed', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), adaptiveNode({ activeWhenRef: 'no-such-id' })], orchestrationContracts: [],
      })
      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const program = result.state.orchestration.find(n => n.kind === 'program')
      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('S6 case 16b 老策略 (deployedAtSemanticVersion=null) → fail-closed', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), adaptiveNode()], orchestrationContracts: [],
      })
      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = new SemanticContractReadinessService().normalize(state, legacy)
      const program = result.state.orchestration.find(n => n.kind === 'program')
      expect(program?.openSlots ?? []).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('S6 case 17 fixed_grid_gated + adaptive_volatility_grid 共存互不干扰', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), fixedGridGatedNode(), adaptiveNode()], orchestrationContracts: [],
      })
      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const programs = (result.state.orchestration ?? []).filter(n => n.kind === 'program')
      expect(programs).toHaveLength(2)
      for (const p of programs) {
        expect(p.status).toBe('locked')
        expect(p.openSlots ?? []).not.toContainEqual(expect.objectContaining({
          slotKey: 'orchestration.phase0.unsupported',
        }))
      }
    })

    it('Test K: gate.regime + portfolioRisk.drawdown_block + program.fixed_grid_gated 三者共存互不干扰', () => {
      const drawdownNode: SemanticOrchestrationNode = {
        id: 'pr-drawdown-coexist',
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
        status: 'locked',
        source: 'user_explicit',
        params: {},
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
        openSlots: [],
        contracts: [],
      }
      const state = createSemanticState({
        orchestration: [regimeGateNode(), drawdownNode, fixedGridGatedNode()],
          orchestrationContracts: [],
      })

      const result = new SemanticContractReadinessService().normalize(state, CURRENT_VERSION)
      const nodes = result.state.orchestration ?? []

      expect(nodes).toHaveLength(3)
      for (const n of nodes) {
        expect(n.status).toBe('locked')
        expect(n.openSlots ?? []).not.toContainEqual(expect.objectContaining({
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

  function contextSlot(field: 'exchange' | 'symbol' | 'marketType', value: string) {
    return {
      slotKey: `context.${field}`,
      fieldPath: `contextSlots.${field}`,
      value,
      status: 'locked' as const,
      priority: 'core' as const,
      affectsExecution: true,
      questionHint: '',
    }
  }

  it('treats explicit multi-timeframe trigger members in the same rule as ready', () => {
    const ema20Above = (timeframe: string) => ({
      kind: 'atom' as const,
      key: 'indicator.above',
      params: { indicator: 'ema', 'reference.period': 20, timeframe },
    })
    const ema20Below = (timeframe: string) => ({
      kind: 'atom' as const,
      key: 'indicator.below',
      params: { indicator: 'ema', 'reference.period': 20, timeframe },
    })

    const state = createSemanticState({
      contextSlots: {
        exchange: contextSlot('exchange', 'binance'),
        symbol: contextSlot('symbol', 'BTCUSDT'),
        marketType: contextSlot('marketType', 'perpetual'),
        timeframe: timeframeSlot('15m'),
      },
      rules: [{
        id: 'entry-mtf-ema20',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            ema20Above('15m'),
            ema20Above('1h'),
            ema20Above('4h'),
          ],
        },
        effects: [{
          kind: 'atom',
          key: 'action.open_long',
          params: {},
        }],
      }, {
        id: 'exit-ema20',
        phase: 'exit',
        sideScope: 'long',
        condition: ema20Below('15m'),
        effects: [{
          kind: 'atom',
          key: 'action.close_long',
          params: {},
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
    expect(result.state.trigger.flatMap(trigger => trigger.openSlots ?? [])).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: expect.stringContaining('contract.timeframe_mismatch.trigger.'),
      }),
    ]))
  })

  it('reports ready=true when trigger timeframe aligns with execution context timeframe', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: timeframeSlot('1h'),
      },
      trigger: [{
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
      action: [baseAction],
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
      trigger: [{
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
      action: [baseAction],
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
    expect(result.state.trigger[0].openSlots).toEqual(expect.arrayContaining([
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
      trigger: [{
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
      action: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    const mismatches = result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')
    expect(mismatches.map(m => m.ownerId).sort()).toEqual(['trigger-misaligned-a', 'trigger-misaligned-b'])
  })

  it('does not raise timeframe mismatch when execution context timeframe is missing', () => {
    const state = createSemanticState({
      trigger: [{
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
      action: [baseAction],
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
      trigger: [{
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
      action: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
    expect(result.ready).toBe(true)
  })

  it('treats grid-only rules as executable entry and exit without legacy flat buckets', () => {
    const rules: SemanticRule[] = [{
      id: 'program-grid-range',
      phase: 'program',
      sideScope: 'both',
      condition: {
        kind: 'atom',
        key: 'grid.range_rebalance',
        params: {
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 0.5,
          sideMode: 'both',
          breakoutAction: 'continue',
        },
      },
      effects: {
        actions: [],
        risks: [],
        positions: [{
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            rangeLower: 60000,
            rangeUpper: 80000,
            stepPct: 0.5,
            sideMode: 'both',
            breakoutAction: 'continue',
            phase: 'program',
          },
        }],
        orchestration: [],
        programs: [],
      },
    }]

    const result = new SemanticContractReadinessService().evaluateRulesReadiness(rules)

    expect(result.hasEntry).toBe(true)
    expect(result.hasExit).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('treats grid condition perGridSizing as executable sizing when effect carries only lifecycle params', () => {
    const state = createSemanticState({
      contextSlots: {
        exchange: { slotKey: 'context.exchange', status: 'locked', value: 'okx', source: 'user_explicit' },
        symbol: { slotKey: 'context.symbol', status: 'locked', value: 'BTCUSDT', source: 'user_explicit' },
        marketType: { slotKey: 'context.marketType', status: 'locked', value: 'perp', source: 'user_explicit' },
        timeframe: { slotKey: 'context.timeframe', status: 'locked', value: '15m', source: 'user_explicit' },
      },
      rules: [{
        id: 'program-fixed-grid-range-50000-60000-10-5pct-uptrend-enable',
        phase: 'program',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: {
            levels: 10,
            stepPct: 5,
            sideMode: 'both',
            rangeLower: 50000,
            rangeUpper: 60000,
            perGridSizing: 1,
            breakoutAction: 'continue',
          },
        },
        effects: {
          actions: [],
          risks: [],
          positions: [{ kind: 'atom', key: 'grid.range_rebalance', params: { sideMode: 'both', recycle: 'true' } }],
          orchestration: [],
          programs: [{ kind: 'atom', key: 'program.fixed_grid_gated', params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5, onDeactivate: 'cancel', programKind: 'fixed_grid_gated' } }],
        },
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state, { deployedAtSemanticVersion: '2026.05.W02' })

    expect(result.ready).toBe(true)
    expect(result.state.position?.openSlots ?? []).not.toContainEqual(expect.objectContaining({ slotKey: 'position.sizing' }))
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
      trigger: [{
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
      action: [baseAction],
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
      trigger: [{
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
      action: [baseAction],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    // 核心断言：timeframe_mismatch 被豁免（timeframeOverride=true）
    expect(result.missingRequirements.filter(r => r.kind === 'timeframe_mismatch')).toEqual([])
  })

  // PR3.4: CapabilityEvidenceIndex 路径——纯 DCA utterance per_order_budget 通过 EvidenceIndex 判 satisfied
  it('PR3.4: per_order_budget requirement satisfied via CapabilityEvidenceIndex when DCA action provides the capability', () => {
    const state = createSemanticState({
      action: [
        {
          id: 'action-grid-ladder',
          key: 'action.grid_ladder',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          support: { supportStatus: 'supported_executable' },
          contracts: [{
            id: 'contract-grid-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: { timeInForce: 'gtc' },
            }],
            requires: [
              { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
        {
          id: 'action-dca',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          support: { supportStatus: 'supported_executable' },
          contracts: [{
            id: 'contract-dca-budget',
            kind: 'action',
            capabilities: [{
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: { kind: 'quote', value: 100, asset: 'USDT' },
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
    })

    const result = new SemanticContractReadinessService().normalize(state)

    // per_order_budget requirement は EvidenceIndex 経由で satisfied と判定される
    const capitalMissing = result.missingRequirements.filter(
      r => r.domain === 'capital' && r.verb === 'allocate' && r.object === 'per_order_budget',
    )
    expect(capitalMissing).toHaveLength(0)
  })

  // PR3.4 Q1 negative path: open-status owner emit capability is NOT counted as satisfied evidence
  it('PR3.4 Q1: per_order_budget requirement NOT satisfied when only an OPEN-status action provides the capability', () => {
    const state = createSemanticState({
      action: [
        {
          id: 'action-grid-ladder',
          key: 'action.grid_ladder',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          support: { supportStatus: 'supported_executable' },
          contracts: [{
            id: 'contract-grid-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: { timeInForce: 'gtc' },
            }],
            requires: [
              { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
            ],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
        {
          id: 'action-dca-open',
          key: 'open_long',
          status: 'open',                          // ← key: open, not locked
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'position.dca_schedule.per_order_sizing',
            fieldPath: 'actions[action-dca-open].sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认每次 DCA 补仓多少。',
            affectsExecution: true,
          }],
          support: { supportStatus: 'supported_executable' },
          contracts: [{
            id: 'contract-dca-budget-open',
            kind: 'action',
            capabilities: [{
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: { kind: 'quote', value: 100, asset: 'USDT' },
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
    })

    const result = new SemanticContractReadinessService().normalize(state)

    // per_order_budget requirement 必须仍在 missingRequirements 中 — open owner 不算 satisfied evidence
    const capitalMissing = result.missingRequirements.filter(
      r => r.domain === 'capital' && r.verb === 'allocate' && r.object === 'per_order_budget',
    )
    expect(capitalMissing.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// #1186 PR3 — multi-leg per-leg anchored gating (decision 选项 A)
// ---------------------------------------------------------------------------
// 决策: docs/decisions/2026-05-11-multi-leg-budget-readiness.md
// 多腿场景下，per_order_budget requirement 满足判定改为：每条 leg 各自 capability 都 anchored 才 satisfied。
// executable_legs 来源统一调 resolver.getExecutableLegScopes()（critic C3）。
// ---------------------------------------------------------------------------

describe('#1186 PR3 — multi-leg per_order_budget per-leg anchored', () => {
    function buildMultiLegConsumer() {
      // action.grid_ladder は registered atom で per_order_budget を requires する既知キー
      return {
        id: 'action-consumer',
        key: 'action.grid_ladder',
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
        support: { supportStatus: 'supported_executable' as const },
        contracts: [{
          id: 'contract-consumer',
          kind: 'action' as const,
          capabilities: [{
            domain: 'order_program' as const,
            verb: 'maintain' as const,
            object: 'limit_ladder' as const,
            shape: { timeInForce: 'gtc' },
          }],
          requires: [
            { domain: 'capital' as const, verb: 'allocate' as const, object: 'per_order_budget' as const },
          ],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }
    }

    function buildAnchoredLeg(id: string, value: number) {
      return {
        id,
        key: 'open_long',
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
        support: { supportStatus: 'supported_executable' as const },
        contracts: [{
          id: `contract-${id}`,
          kind: 'action' as const,
          capabilities: [{
            domain: 'capital' as const,
            verb: 'allocate' as const,
            object: 'per_order_budget' as const,
            shape: { kind: 'quote', value, asset: 'USDT' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }
    }

    function buildOpenLeg(id: string) {
      // 同 capability shape 但 owner status=open（缺 anchored）
      return {
        id,
        key: 'open_long',
        status: 'open' as const,
        source: 'user_explicit' as const,
        openSlots: [{
          slotKey: 'position.dca_schedule.per_order_sizing',
          fieldPath: `actions[${id}].sizing`,
          status: 'open' as const,
          priority: 'risk' as const,
          questionHint: '请确认每次补仓多少。',
          affectsExecution: true,
        }],
        support: { supportStatus: 'supported_executable' as const },
        contracts: [{
          id: `contract-${id}`,
          kind: 'action' as const,
          capabilities: [{
            domain: 'capital' as const,
            verb: 'allocate' as const,
            object: 'per_order_budget' as const,
            shape: { kind: 'quote', value: 200, asset: 'USDT' },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }
    }

    // case A：multi-leg + 双 anchored → satisfied=true（per_order_budget 不在 missingRequirements）
    it('case A — multi-leg + 双 leg 各自 anchored → per_order_budget 判 satisfied', () => {
      const state = createSemanticState({
        isMultiLeg: true,
        action: [
          buildMultiLegConsumer(),
          buildAnchoredLeg('action-leg-a', 100),
          buildAnchoredLeg('action-leg-b', 200),
        ],
      })

      const result = new SemanticContractReadinessService().normalize(state)

      const capitalMissing = result.missingRequirements.filter(
        r => r.domain === 'capital' && r.verb === 'allocate' && r.object === 'per_order_budget',
      )
      expect(capitalMissing).toHaveLength(0)
    })

    // case B：multi-leg + leg-B 缺 anchor → satisfied=false + mismatch entry 含 READINESS_PER_ORDER_BUDGET_MISSING
    it('case B — multi-leg + 单 leg 缺 anchored → per_order_budget mismatch + errorCode READINESS_PER_ORDER_BUDGET_MISSING', () => {
      const state = createSemanticState({
        isMultiLeg: true,
        action: [
          buildMultiLegConsumer(),
          buildAnchoredLeg('action-leg-a', 100),
          buildOpenLeg('action-leg-b'),
        ],
      })

      const result = new SemanticContractReadinessService().normalize(state)

      const capitalMissing = result.missingRequirements.filter(
        r => r.domain === 'capital' && r.verb === 'allocate' && r.object === 'per_order_budget',
      )
      expect(capitalMissing.length).toBeGreaterThan(0)
      expect(capitalMissing.every(r => r.errorCode === 'READINESS_PER_ORDER_BUDGET_MISSING')).toBe(true)
    })

    // case C（回归）：单腿 + 单 anchor → satisfied=true（等价 #1175 行为）
    it('case C — 单腿（isMultiLeg 缺省）+ 单 anchor → 行为零变更（satisfied）', () => {
      const state = createSemanticState({
        action: [
          buildMultiLegConsumer(),
          buildAnchoredLeg('action-leg-only', 100),
        ],
      })

      const result = new SemanticContractReadinessService().normalize(state)

      const capitalMissing = result.missingRequirements.filter(
        r => r.domain === 'capital' && r.verb === 'allocate' && r.object === 'per_order_budget',
      )
      expect(capitalMissing).toHaveLength(0)
    })
})

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
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
    updatedAt: '2026-05-03T00:00:00.000Z',
    ...overrides,
  }
}
