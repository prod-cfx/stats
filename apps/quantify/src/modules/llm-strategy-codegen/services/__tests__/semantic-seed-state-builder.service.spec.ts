import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('SemanticSeedStateBuilderService', () => {
  const service = new SemanticSeedStateBuilderService()

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
      openSlots: [expect.objectContaining({
        slotKey: 'trigger.reference_definition',
        status: 'open',
      })],
    }))
  })

  it('keeps legacy lightweight trigger patches locked by default', () => {
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
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
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
    expect(state?.actions[0]?.openSlots).toEqual([expect.objectContaining({
      slotKey: 'action.order_type',
      status: 'open',
      questionHint: '请确认开仓订单类型。',
    })])
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
})
