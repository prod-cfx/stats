import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('SemanticSeedStateBuilderService', () => {
  const service = new SemanticSeedStateBuilderService()
  const expectContractRequiredSlot = (fieldPath: string) => expect.objectContaining({
    slotKey: 'contract.required',
    fieldPath,
    status: 'open',
  })
  const riskContract = {
    id: 'risk-contract',
    kind: 'risk',
    capabilities: [{
      domain: 'guard',
      verb: 'enforce',
      object: 'risk_rule',
      shape: { configured: true },
    }],
    requires: [],
    params: {},
  }

  it('preserves open trigger envelope from semantic seed patch', () => {
    const state = service.build({
      triggers: [{
        id: 'trigger-open-breakout',
        key: 'price.breakout_up',
        phase: 'entry',
        sideScope: 'long',
        status: 'open',
        source: 'user_explicit',
        params: { reference: 'unknown' },
        evidence: { text: '突破关键位置开多', source: 'user_explicit' },
        openSlots: [{
          slotKey: 'trigger.reference_definition',
          fieldPath: 'triggers[0].params.reference',
          status: 'open',
          priority: 'core',
          questionHint: '请确认突破参考位置如何定义。',
          affectsExecution: true,
          evidence: { text: '关键位置', source: 'user_explicit' },
        }],
      }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      id: 'trigger-open-breakout',
      key: 'price.breakout_up',
      phase: 'entry',
      sideScope: 'long',
      status: 'open',
      source: 'user_explicit',
      params: { reference: 'unknown' },
      openSlots: expect.arrayContaining([expect.objectContaining({
        slotKey: 'trigger.reference_definition',
        status: 'open',
      })]),
    }))
  })

  it('synthesizes contracts for complete lightweight planner patches and keeps them locked', () => {
    const state = service.build({
      triggers: [{
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }, {
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: {
          direction: 'up',
          valuePct: 3,
        },
      }],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.max_drawdown_pct', params: { valuePct: 10 } }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      },
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [expect.objectContaining({
        kind: 'trigger',
        capabilities: [expect.objectContaining({
          domain: 'price',
          verb: 'detect',
          object: 'signal_condition',
          shape: expect.objectContaining({ key: 'condition.expression', phase: 'entry', sideScope: 'long' }),
        })],
      })],
    }))
    expect(state?.triggers[1]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ valuePct: 3 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'price.percent_change', valuePct: 3 }),
        })],
      })],
    }))
    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [expect.objectContaining({
        kind: 'action',
        capabilities: [expect.objectContaining({
          domain: 'order_program',
          verb: 'execute',
          object: 'order_action',
          shape: expect.objectContaining({ key: 'open_long', side: 'long', intent: 'open' }),
        })],
      })],
    }))
    expect(state?.risk[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [expect.objectContaining({
        kind: 'risk',
        capabilities: [expect.objectContaining({
          domain: 'guard',
          verb: 'enforce',
          object: 'max_drawdown',
          shape: expect.objectContaining({ key: 'risk.max_drawdown_pct', valuePct: 10 }),
        })],
      })],
    }))
    expect(state?.position).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [expect.objectContaining({
        kind: 'position',
        capabilities: [expect.objectContaining({
          domain: 'capital',
          verb: 'allocate',
          object: 'position_sizing',
          shape: expect.objectContaining({ mode: 'fixed_ratio', value: 0.1, positionMode: 'long' }),
        })],
      })],
    }))
  })

  it('keeps unknown bare executable patches open until contracts are supplied', () => {
    const state = service.build({
      triggers: [{
        key: 'unknown.trigger',
        phase: 'entry',
        params: { value: 1 },
      }],
      risk: [{ key: 'risk.unknown_guard', params: { valuePct: 10 } }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('triggers[0].contracts')],
    }))
    expect(state?.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('risk[0].contracts')],
    }))
  })

  it('keeps superseded executable atoms without contracts superseded', () => {
    const state = service.build({
      triggers: [{
        key: 'unknown.trigger',
        phase: 'entry',
        status: 'superseded',
      }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'superseded',
      openSlots: [],
    }))
  })

  it('drops stale contract required slots when contracts become available', () => {
    const state = service.build({
      actions: [{
        key: 'open_long',
        openSlots: [{
          slotKey: 'contract.required',
          fieldPath: 'actions[0].contracts',
          status: 'open',
          priority: 'behavior',
          questionHint: '请补充该原子的执行合约。',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
      contracts: [expect.objectContaining({ kind: 'action' })],
    }))
  })

  it('preserves existing atom open slots while synthesized contracts cover execution', () => {
    const state = service.build({
      actions: [{
        key: 'open_long',
        openSlots: [{
          slotKey: 'action.order_type',
          fieldPath: 'actions[0].params.orderType',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认开仓订单类型。',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.actions[0]?.status).toBe('open')
    expect(state?.actions[0]?.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        fieldPath: 'actions[0].params.orderType',
      }),
    ])
    expect(state?.actions[0]?.contracts).toEqual([expect.objectContaining({ kind: 'action' })])
  })

  it('does not add contract required slots to context slots', () => {
    const state = service.build({
      contextSlots: {
        symbol: 'BTCUSDT',
      },
    })

    expect(state?.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      status: 'locked',
    }))
  })

  it('preserves action open slots from semantic seed patch', () => {
    const state = service.build({
      actions: [{
        key: 'open_long',
        openSlots: [{
          slotKey: 'action.order_type',
          fieldPath: 'actions[0].params.orderType',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认开仓订单类型。',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.actions[0]).toEqual(expect.objectContaining({
      key: 'open_long',
      status: 'open',
      source: 'user_explicit',
    }))
    expect(state?.actions[0]?.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
        questionHint: '请确认开仓订单类型。',
      }),
    ])
    expect(state?.actions[0]?.contracts).toEqual([expect.objectContaining({ kind: 'action' })])
  })

  it('preserves semantic atom contracts from semantic seed patch', () => {
    const state = service.build({
      triggers: [{
        key: 'grid.price_levels',
        phase: 'entry',
        contracts: [{
          id: 'trigger-1',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 60000, upper: 80000, gridCount: 100, spacingMode: 'arithmetic' },
          }],
          requires: [],
          params: {},
        }],
      }],
      actions: [{
        key: 'grid.limit_ladder',
        contracts: [{
          id: 'action-1',
          kind: 'action',
          capabilities: [{
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          }],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
            { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
          ],
          params: {},
        }],
      }],
      risk: [{
        key: 'grid.exposure_guard',
        contracts: [{
          id: 'risk-1',
          kind: 'risk',
          capabilities: [{
            domain: 'guard',
            verb: 'enforce',
            object: 'drawdown_limit',
            shape: { value: 0.2 },
          }],
          requires: [],
          params: {},
        }],
      }],
      position: {
        mode: 'fixed',
        value: 20,
        positionMode: 'long',
        contracts: [{
          id: 'position-1',
          kind: 'position',
          capabilities: [{
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 20, asset: 'USDT' },
          }],
          requires: [],
          params: {},
        }],
      },
    })

    expect(state?.triggers[0]?.contracts).toEqual([
      expect.objectContaining({
        id: 'trigger-1',
        capabilities: [expect.objectContaining({ domain: 'price', verb: 'define', object: 'level_set' })],
      }),
    ])
    expect(state?.actions[0]?.contracts).toEqual([
      expect.objectContaining({
        id: 'action-1',
        requires: [
          { domain: 'price', verb: 'define', object: 'level_set' },
          { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
        ],
      }),
    ])
    expect(state?.risk[0]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      domain: 'guard',
      verb: 'enforce',
      object: 'drawdown_limit',
    }))
    expect(state?.position?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
    }))
  })

  it('rejects a semantic atom contract when a nested requirement is malformed', () => {
    const state = service.build({
      actions: [{
        key: 'grid.limit_ladder',
        contracts: [{
          id: 'action-1',
          kind: 'action',
          capabilities: [{
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          }],
          requires: [
            { domain: 'price', verb: 'define', object: 'level_set' },
            { domain: 'capital', verb: '', object: 'per_order_budget' },
          ],
          params: {},
        }],
      }],
    })

    expect(state?.actions[0]?.contracts).toBeUndefined()
  })

  it('normalizes planner basis open slot before resolving risk status', () => {
    const state = service.build({
      risk: [{
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        source: 'derived',
        evidence: { text: '按止损基准亏损 5%', source: 'user_explicit' },
        supersedes: ['risk-old'],
        contracts: [riskContract],
        openSlots: [{
          slotKey: 'risk.stopLossBasis',
          fieldPath: 'risk[0].params.stopLossBasis',
          questionHint: '请确认止损基准',
          status: 'open',
          priority: 'risk',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.risk[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'derived',
      evidence: { text: '按止损基准亏损 5%', source: 'user_explicit' },
      supersedes: ['risk-old'],
      params: expect.objectContaining({
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
      openSlots: [],
    }))
  })

  it('preserves planner risk expression as structured recognized unsupported risk', () => {
    const state = service.build({
      risk: [{
        key: 'risk.condition_expression',
        params: {
          condition: {
            kind: 'predicate',
            left: { kind: 'position', field: 'pnl_pct' },
            op: 'LTE',
            right: { kind: 'constant', value: -5 },
          },
          effect: { type: 'close_position' },
          scope: 'current_position',
        },
        contracts: [riskContract],
        openSlots: [{
          slotKey: 'risk.stopLossBasis',
          fieldPath: 'risk[0].params.basis',
          questionHint: '请确认计算基准',
          status: 'open',
          priority: 'risk',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        capabilityStatus: 'recognized_unsupported',
      }),
      openSlots: [],
    }))
  })
})
