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

  it('normalizes planner basis open slot before resolving risk status', () => {
    const state = service.build({
      risk: [{
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
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
