import { buildSemanticSlotId } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateReducerService } from '../semantic-state-reducer.service'

describe('SemanticSeedStateBuilderService', () => {
  const service = new SemanticSeedStateBuilderService()
  const reducer = new SemanticStateReducerService()
  const openSlotAnswerResolver = new SemanticOpenSlotAnswerResolverService()
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

  it('creates answerable confirmation slots for synthesized bollinger trigger forks', () => {
    const state = service.build({
      triggers: [{
        id: 'entry-bollinger-upper',
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: {
          period: 20,
          stdDev: 2,
          band: 'upper',
        },
      }],
    })
    const slot = {
      slotKey: 'confirmationMode.entry',
      fieldPath: 'triggers[0].params.confirmationMode',
    }

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      params: expect.not.objectContaining({ confirmationMode: expect.anything() }),
      openSlots: expect.arrayContaining([expect.objectContaining({
        ...slot,
        status: 'open',
      })]),
    }))

    const next = reducer.applyClarificationAnswer({
      currentState: state!,
      targetSlotKey: slot.slotKey,
      targetFieldPath: slot.fieldPath,
      targetSlotId: buildSemanticSlotId(slot),
      answer: '收盘确认',
    })

    expect(next.triggers[0]?.params.confirmationMode).toBe('close_confirm')
    expect(next.triggers[0]?.openSlots.find(item =>
      item.slotKey === slot.slotKey
      && item.fieldPath === slot.fieldPath
      && item.status === 'open',
    )).toBeUndefined()
  })

  it('synthesizes fixed grid level-set contracts with density slots instead of generic contract prompts', () => {
    const state = service.build({
      triggers: [{
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'both',
        params: {
          rangeMin: 79200,
          rangeMax: 80200,
          sideMode: 'bidirectional',
        },
      }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      key: 'grid.range_rebalance',
      status: 'open',
      openSlots: expect.arrayContaining([expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.density',
        status: 'open',
        questionHint: expect.stringContaining('网格数量或每格间距'),
      })]),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape: expect.objectContaining({
            mode: 'fixed_range',
            lower: 79200,
            upper: 80200,
          }),
        })],
      })],
    }))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('closes synthesized fixed grid density slots from percent spacing answers', () => {
    const state = service.build({
      triggers: [{
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'both',
        params: {
          rangeMin: 79200,
          rangeMax: 80200,
          sideMode: 'bidirectional',
        },
      }],
    })
    const densitySlot = state?.triggers[0]?.openSlots.find(slot =>
      slot.slotKey === 'contract.shape.price.level_set.density',
    )
    expect(densitySlot).toBeDefined()

    const resolved = openSlotAnswerResolver.resolve({
      currentState: state!,
      message: '步长0.5%',
      clarificationState: {
        items: [{
          status: 'pending',
          slotKey: densitySlot!.slotKey,
          fieldPath: densitySlot!.fieldPath,
          slotId: buildSemanticSlotId(densitySlot!),
        }],
      },
    })
    if (!resolved.consumed) {
      throw new Error('expected grid density answer to be consumed')
    }

    const shape = resolved.nextState.triggers[0]?.contracts?.[0]?.capabilities[0]?.shape

    expect(shape).toEqual(expect.objectContaining({
      spacingPct: 0.5,
    }))
    expect(resolved.nextState.triggers[0]?.openSlots).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.density',
        status: 'open',
      }),
    ]))
  })

  it('creates answerable confirmation slots for universal bollinger boundary atoms', () => {
    const state = service.build({
      triggers: [{
        id: 'entry-bollinger-boundary',
        key: 'price.detect.indicator_boundary',
        phase: 'entry',
        sideScope: 'short',
        params: {
          indicator: {
            name: 'bollinger',
            period: 20,
            stdDev: 2,
          },
          boundaryRole: 'upper',
        },
      }],
    })
    const slot = {
      slotKey: 'confirmationMode.entry',
      fieldPath: 'triggers[0].params.confirmationMode',
    }

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      params: expect.not.objectContaining({ confirmationMode: expect.anything() }),
      openSlots: expect.arrayContaining([expect.objectContaining({
        ...slot,
        status: 'open',
      })]),
    }))

    const next = reducer.applyClarificationAnswer({
      currentState: state!,
      targetSlotKey: slot.slotKey,
      targetFieldPath: slot.fieldPath,
      targetSlotId: buildSemanticSlotId(slot),
      answer: '盘中触碰就触发',
    })

    expect(next.triggers[0]?.params.confirmationMode).toBe('touch')
    expect(next.triggers[0]?.openSlots.find(item =>
      item.slotKey === slot.slotKey
      && item.fieldPath === slot.fieldPath
      && item.status === 'open',
    )).toBeUndefined()
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
      }, {
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: {
          indicator: 'ma',
          fastPeriod: 20,
          slowPeriod: 50,
        },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        sideScope: 'long',
        params: {
          lookbackBars: 20,
          thresholdPct: 45,
        },
      }],
      actions: [{ key: 'open_long' }],
      risk: [{
        key: 'risk.max_drawdown_pct',
        params: { valuePct: 10 },
      }, {
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
      }],
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
    expect(state?.triggers[2]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ indicator: 'ma', fastPeriod: 20, slowPeriod: 50 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'indicator.cross_over', indicator: 'ma' }),
        })],
      })],
    }))
    expect(state?.triggers[3]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ lookbackBars: 20, thresholdPct: 45 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'price.range_position_lte', lookbackBars: 20, thresholdPct: 45 }),
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
    expect(state?.risk[1]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [expect.objectContaining({
        kind: 'risk',
        capabilities: [expect.objectContaining({
          domain: 'guard',
          verb: 'enforce',
          object: 'risk_condition',
          shape: expect.objectContaining({ key: 'risk.condition_expression', scope: 'current_position' }),
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
          shape: expect.objectContaining({ mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' }),
        })],
      })],
      positionMode: 'long_only',
    }))
  })

  it('keeps unknown bare executable patches open until contracts are supplied', () => {
    const state = service.build({
      triggers: [{
        key: 'unknown.trigger',
        phase: 'entry',
        params: { value: 1 },
      }],
      actions: [{ key: 'rebalance_magic' }],
      risk: [{ key: 'risk.unknown_guard', params: { valuePct: 10 } }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('triggers[0].contracts')],
    }))
    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('actions[0].contracts')],
    }))
    expect(state?.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('risk[0].contracts')],
    }))
  })

  it('keeps incomplete lightweight trigger patches open until contract inputs are supplied', () => {
    const state = service.build({
      triggers: [{
        key: 'indicator.cross_over',
        phase: 'entry',
        params: {},
      }, {
        key: 'price.percent_change',
        phase: 'entry',
        params: { valuePct: 0 },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        params: { valuePct: 45 },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        params: { lookbackBars: 20, thresholdPct: 0 },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        params: { lookbackBars: 20, thresholdPct: -1 },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        params: { lookbackBars: 20, thresholdPct: 150 },
      }, {
        key: 'price.range_position_lte',
        phase: 'entry',
        params: { lookbackBars: 20.5, thresholdPct: 45 },
      }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[0].contracts')],
    }))
    expect(state?.triggers[1]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[1].contracts')],
    }))
    expect(state?.triggers[2]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[2].contracts')],
    }))
    expect(state?.triggers[3]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[3].contracts')],
    }))
    expect(state?.triggers[4]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[4].contracts')],
    }))
    expect(state?.triggers[5]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[5].contracts')],
    }))
    expect(state?.triggers[6]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[6].contracts')],
    }))
  })

  it('keeps incomplete lightweight risk patches open until required params are supplied', () => {
    const validCondition = {
      kind: 'predicate',
      left: { kind: 'position', field: 'pnl_pct' },
      op: 'LTE',
      right: { kind: 'constant', value: -5 },
    }
    const state = service.build({
      risk: [{
        key: 'risk.stop_loss_pct',
        params: {},
      }, {
        key: 'risk.max_drawdown_pct',
        params: { valuePct: 0 },
      }, {
        key: 'risk.condition_expression',
        params: {
          condition: { kind: 'predicate' },
          effect: { type: 'close_position' },
          scope: 'current_position',
        },
      }, {
        key: 'risk.condition_expression',
        params: {
          condition: validCondition,
          effect: { type: 'liquidate_everything' },
          scope: 'current_position',
        },
      }, {
        key: 'risk.condition_expression',
        params: {
          condition: validCondition,
          effect: { type: 'close_position' },
          scope: 'planet',
        },
      }, {
        key: 'risk.condition_expression',
        params: {
          condition: {
            kind: 'expression',
            left: { kind: 'position', field: 'pnl_pct' },
            op: 'LTE',
            right: { kind: 'constant', value: -5 },
          },
          effect: { type: 'close_position' },
          scope: 'current_position',
        },
      }],
    })

    expect(state?.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[0].contracts')],
    }))
    expect(state?.risk[1]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[1].contracts')],
    }))
    expect(state?.risk[2]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[2].contracts')],
    }))
    expect(state?.risk[3]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[3].contracts')],
    }))
    expect(state?.risk[4]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[4].contracts')],
    }))
    expect(state?.risk[5]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('risk[5].contracts')],
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
        }, {
          slotKey: 'contract.required',
          fieldPath: 'actions[1].contracts',
          status: 'open',
          priority: 'behavior',
          questionHint: '请补充另一原子的执行合约。',
          affectsExecution: true,
        }],
      }],
    })

    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('actions[1].contracts')],
      contracts: [expect.objectContaining({ kind: 'action' })],
    }))
  })

  it('keeps position updates open when sizing mode cannot synthesize a contract', () => {
    const state = service.build({
      position: {
        mode: 'rebalance_ratio',
        value: 0.1,
        positionMode: 'long',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      },
    })

    expect(state?.position).toEqual(expect.objectContaining({
      status: 'open',
      mode: 'rebalance_ratio',
      positionMode: 'long_only',
      openSlots: [expectContractRequiredSlot('position.contracts')],
    }))
    expect(state?.position?.contracts).toBeUndefined()
  })

  it('keeps zero-value position updates open until valid sizing is supplied', () => {
    const state = service.build({
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long',
      },
    })

    expect(state?.position).toEqual(expect.objectContaining({
      status: 'open',
      mode: 'fixed_ratio',
      value: 0,
      positionMode: 'long_only',
      openSlots: [expectContractRequiredSlot('position.contracts')],
    }))
    expect(state?.position?.contracts).toBeUndefined()
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

  it('normalizes string context symbol values through the market instrument resolver', () => {
    const state = service.build({
      contextSlots: {
        symbol: 'ETH usdt',
      },
      triggers: [{
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'ETHUSDT',
      status: 'locked',
      evidence: expect.objectContaining({
        text: 'ETH usdt',
        source: 'user_explicit',
      }),
      contracts: expect.arrayContaining([
        expect.objectContaining({
          kind: 'context',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'market',
              verb: 'identify',
              object: 'instrument',
              shape: expect.objectContaining({
                base: 'ETH',
                quote: 'USDT',
                symbol: 'ETHUSDT',
                quoteSource: 'explicit',
              }),
            }),
          ]),
        }),
      ]),
    }))
  })

  it('normalizes structured inferred symbol patch values and preserves inferred evidence', () => {
    const state = service.build({
      contextSlots: {
        symbol: {
          value: 'ETH',
          source: 'inferred',
          evidenceText: 'ETH',
          base: 'ETH',
          quote: 'USDT',
          quoteSource: 'default_usdt',
        },
      },
      triggers: [{
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.contextSlots.symbol?.value).toBe('ETHUSDT')
    expect(state?.contextSlots.symbol?.evidence).toEqual(expect.objectContaining({
      text: 'ETH',
      source: 'inferred',
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

  it('keeps recognized unsupported atoms as semantic atoms without open slot conversion', () => {
    const state = service.build({
      triggers: [{
        key: 'volume.spike',
        phase: 'entry',
        params: { sourceText: '放量突破' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }, {
        key: 'volume.threshold',
        phase: 'entry',
        params: { sourceText: '成交量阈值' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }, {
        key: 'volatility.atr_threshold',
        phase: 'gate',
        params: { sourceText: 'ATR threshold filter' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      risk: [{
        key: 'risk.atr_stop',
        params: { sourceText: 'ATR 移动止损' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }, {
        key: 'risk.partial_take_profit',
        params: { sourceText: '分批止盈' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })

    expect(state?.triggers).toHaveLength(3)
    expect(state?.risk).toHaveLength(2)
    for (const node of [...(state?.triggers ?? []), ...(state?.risk ?? [])]) {
      expect(node.openSlots).toEqual([])
      expect(node.contracts).toEqual(expect.arrayContaining([expect.objectContaining({
        capabilities: expect.any(Array),
      })]))
    }
    expect(state?.triggers[0]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volume_condition',
    }))
    expect(state?.triggers[1]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volume_condition',
    }))
    expect(state?.triggers[2]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volatility_condition',
    }))
    expect(state?.risk[0]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'atr_stop',
    }))
    expect(state?.risk[1]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'partial_take_profit',
    }))
  })
})
