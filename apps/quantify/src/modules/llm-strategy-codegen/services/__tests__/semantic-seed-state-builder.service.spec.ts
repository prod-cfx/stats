import { buildSemanticSlotId } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { type EvidenceInvariantMode, SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
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
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
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

    expect(next.trigger[0]?.params.confirmationMode).toBe('close_confirm')
    expect(next.trigger[0]?.openSlots.find(item =>
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

    expect(state?.position?.constraints?.[0]).toEqual(expect.objectContaining({
      key: 'grid.range_rebalance',
      status: 'open',
      openSlots: expect.arrayContaining([expect.objectContaining({
        slotKey: 'grid.range_rebalance.levels',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'levels',
        status: 'open',
        questionHint: expect.stringContaining('网格数量或每格间距'),
      })]),
      contracts: expect.arrayContaining([expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape: expect.objectContaining({
            mode: 'fixed_range',
            lower: 79200,
            upper: 80200,
          }),
        })]),
      })]),
    }))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('synthesizes grid execution contracts for planner grid action keys', () => {
    const state = service.build({
      triggers: [{
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'long',
        params: {
          rangeMin: 2300,
          rangeMax: 2430,
          gridCount: 10,
          sideMode: 'long_only',
        },
      }],
      actions: [{
        key: 'place_limit_grid',
        params: {
          orderType: 'limit',
          timeInForce: 'gtc',
          recycleOnFill: true,
        },
      }],
    })

    expect(state?.action[0]).toEqual(expect.objectContaining({
      key: 'place_limit_grid',
      status: 'locked',
      openSlots: [],
      contracts: [expect.objectContaining({
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
          }),
        ]),
      })],
    }))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('synthesizes one AND action-binding contract for planner EMA stack triggers', () => {
    const state = service.build({
      triggers: [20, 60, 144].map(period => ({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: {
          indicator: 'ema',
          reference: { indicator: 'ema', period },
          'reference.period': period,
          timeframe: '15m',
        },
      })),
      actions: [{ key: 'open_long' }],
    })

    const groupIds = new Set(
      state?.trigger.map(trigger =>
        trigger.contracts?.find(contract => typeof contract.params.groupId === 'string')?.params.groupId,
      ),
    )

    expect(groupIds).toEqual(new Set(['entry-long-ema-above-stack-15m-20-60-144']))
    expect(state?.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            params: expect.objectContaining({
              join: 'AND',
              actionKey: 'open_long',
              actionBinding: 'single_action',
            }),
          }),
        ]),
      }),
    ]))
  })

  it('normalizes mixed existing planner EMA stack contracts into one computed group', () => {
    const legacyCombinationContract = {
      id: 'legacy-entry-ema-20-group',
      kind: 'trigger',
      capabilities: [{
        domain: 'market',
        verb: 'combine',
        object: 'predicate_group',
        shape: { groupId: 'legacy-entry-ema-20-only' },
      }],
      requires: [],
      params: {
        groupId: 'legacy-entry-ema-20-only',
        join: 'AND',
        actionKey: 'open_long',
        actionBinding: 'single_action',
      },
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }
    const state = service.build({
      triggers: [20, 60, 144].map(period => ({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: {
          indicator: 'ema',
          reference: { indicator: 'ema', period },
          'reference.period': period,
          timeframe: '15m',
        },
        ...(period === 20 ? { contracts: [legacyCombinationContract] } : {}),
      })),
      actions: [{ key: 'open_long' }],
    })

    const groupIds = state?.trigger.map(trigger =>
      trigger.contracts?.find(contract => typeof contract.params.groupId === 'string')?.params.groupId,
    )

    expect(groupIds).toEqual([
      'entry-long-ema-above-stack-15m-20-60-144',
      'entry-long-ema-above-stack-15m-20-60-144',
      'entry-long-ema-above-stack-15m-20-60-144',
    ])
  })

  it('preserves executable atom contracts when planner EMA stack params contain loose group markers', () => {
    const state = service.build({
      triggers: [20, 60, 144].map(period => ({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: {
          indicator: 'ema',
          reference: { indicator: 'ema', period },
          'reference.period': period,
          timeframe: '15m',
          groupId: 'loose-planner-marker',
        },
      })),
      actions: [{ key: 'open_long' }],
    })

    for (const trigger of state?.trigger ?? []) {
      expect(trigger.contracts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'price',
              verb: 'detect',
              object: 'signal_condition',
            }),
          ]),
        }),
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'market',
              verb: 'combine',
              object: 'predicate_group',
            }),
          ]),
          params: expect.objectContaining({
            groupId: 'entry-long-ema-above-stack-15m-20-60-144',
          }),
        }),
      ]))
    }
  })

  it('synthesizes supported grid contracts when planner explicitly sends null contracts', () => {
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
        contracts: null,
      }],
      actions: [{
        key: 'place_limit_grid',
        params: {
          orderType: 'limit',
          timeInForce: 'gtc',
        },
        contracts: null,
      }],
    })

    expect(state?.position?.constraints?.[0]).toEqual(expect.objectContaining({
      key: 'grid.range_rebalance',
      openSlots: expect.arrayContaining([expect.objectContaining({
        slotKey: 'grid.range_rebalance.levels',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'levels',
        status: 'open',
      })]),
      contracts: expect.arrayContaining([expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape: expect.objectContaining({
            lower: 79200,
            upper: 80200,
          }),
        })]),
      })]),
    }))
    expect(state?.action[0]).toEqual(expect.objectContaining({
      key: 'place_limit_grid',
      openSlots: [],
      contracts: [expect.objectContaining({
        capabilities: expect.arrayContaining([expect.objectContaining({
          domain: 'order_program',
          verb: 'maintain',
          object: 'limit_ladder',
        })]),
      })],
    }))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('preserves structured DCA capital cap in synthesized contract shape', () => {
    const capitalCap = { kind: 'quote', value: 500, asset: 'USDT' }
    const state = service.build({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        constraints: [{
          key: 'position.dca_schedule',
          params: {
            maxCount: 4,
            capitalCap,
            perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
            triggerMode: 'price_interval',
            exitRule: { rule: 'stop_below_previous_low' },
          },
        }],
      },
    })

    // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
    expect(state?.position?.constraints?.[0]?.contracts?.[0]?.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'runtime',
        verb: 'schedule',
        object: 'dca_orders',
        shape: expect.objectContaining({
          capitalCap,
          perOrderSizing: expect.objectContaining({
            kind: 'quote',
            value: 100,
            asset: 'USDT',
          }),
        }),
      }),
    ]))
  })

  // Issue #1191：pyramiding 原子 emit capital.allocate.per_order_budget capability
  it('emits capital.allocate.per_order_budget capability for pyramiding with layerSizing', () => {
    const state = service.build({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        constraints: [{
          key: 'position.pyramiding_limit',
          params: {
            maxLayers: 3,
            layerSizing: { kind: 'ratio', value: 0.2, unit: 'ratio' },
          },
        }],
      },
    })

    // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
    const capabilities = state?.position?.constraints?.[0]?.contracts?.[0]?.capabilities ?? []
    // 既有 exposure.limit.pyramiding_layers
    expect(capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'exposure',
        verb: 'limit',
        object: 'pyramiding_layers',
      }),
    ]))
    // 新增 capital.allocate.per_order_budget，shape 顶层 kind/value/triggerSource
    expect(capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'capital',
        verb: 'allocate',
        object: 'per_order_budget',
        shape: expect.objectContaining({
          kind: 'ratio',
          value: 0.2,
          triggerSource: 'position.pyramiding_limit',
        }),
      }),
    ]))
  })

  it('skips per_order_budget emit when pyramiding has no layerSizing', () => {
    const state = service.build({
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        constraints: [{
          key: 'position.pyramiding_limit',
          params: { maxLayers: 3 },
        }],
      },
    })

    // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
    const capabilities = state?.position?.constraints?.[0]?.contracts?.[0]?.capabilities ?? []
    expect(capabilities).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        domain: 'capital',
        verb: 'allocate',
        object: 'per_order_budget',
      }),
    ]))
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
    const densitySlot = state?.position?.constraints?.[0]?.openSlots.find(slot =>
      slot.slotKey === 'grid.range_rebalance.levels',
    )
    expect(densitySlot).toBeDefined()

    // #1409: 通用通道按 atomKey+paramSlotKey 调度；levels paramSlot 接受"N 格"格式
    const resolved = openSlotAnswerResolver.resolve({
      currentState: state!,
      message: '20格',
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

    const params = resolved.nextState.position?.constraints?.[0]?.params

    expect(params).toEqual(expect.objectContaining({
      levels: 20,
    }))
    expect(resolved.nextState.position?.constraints?.[0]?.openSlots).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'grid.range_rebalance.levels',
        atomKey: 'grid.range_rebalance',
        paramSlotKey: 'levels',
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
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

    expect(next.trigger[0]?.params.confirmationMode).toBe('touch')
    expect(next.trigger[0]?.openSlots.find(item =>
      item.slotKey === slot.slotKey
      && item.fieldPath === slot.fieldPath
      && item.status === 'open',
    )).toBeUndefined()
  })

  it('synthesizes supported bollinger boundary contracts when planner explicitly sends null contracts', () => {
    const state = service.build({
      triggers: [{
        id: 'entry-bollinger-upper',
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
          confirmationMode: 'close_confirm',
        },
        contracts: null,
      }, {
        id: 'exit-bollinger-middle-short',
        key: 'price.detect.indicator_boundary',
        phase: 'exit',
        sideScope: 'short',
        params: {
          indicator: {
            name: 'bollinger',
            period: 20,
            stdDev: 2,
          },
          boundaryRole: 'middle',
          confirmationMode: 'close_confirm',
        },
        contracts: null,
      }],
    })

    expect(state?.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.detect.indicator_boundary',
        status: 'locked',
        openSlots: [],
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'price',
            verb: 'detect',
            object: 'signal_condition',
          })],
        })],
      }),
    ]))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('synthesizes default MACD cross contracts without asking for execution contracts', () => {
    const state = service.build({
      triggers: [
        {
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'macd', semantic: 'cross_up' },
        },
        {
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: 'macd', semantic: 'cross_down' },
        },
      ],
      actions: [
        { key: 'open_long' },
        { key: 'close_long' },
      ],
    })

    expect(state?.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        status: 'locked',
        contracts: [expect.objectContaining({
          params: expect.objectContaining({
            indicator: 'macd',
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
          }),
        })],
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        status: 'locked',
        contracts: [expect.objectContaining({
          params: expect.objectContaining({
            indicator: 'macd',
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
          }),
        })],
      }),
    ]))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
  })

  it('attaches registry substrate to supported atom contracts', () => {
    const state = service.build({
      triggers: [{
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.trigger[0].contracts?.[0]).toEqual(expect.objectContaining({
      runtimeRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' }),
      ]),
      stateRequirements: expect.any(Array),
      orderRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'order', verb: 'support', object: 'market_order' }),
      ]),
      openSlots: expect.any(Array),
    }))
  })

  it('attaches registry substrate to executable moving-average indicator aliases', () => {
    const state = service.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ema', referenceRole: 'moving_average', 'reference.period': 100 },
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.trigger[0].contracts?.[0]).toEqual(expect.objectContaining({
      runtimeRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' }),
      ]),
      stateRequirements: expect.any(Array),
      orderRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'order', verb: 'support', object: 'market_order' }),
      ]),
      openSlots: expect.any(Array),
    }))
  })

  it('maps supported_requires_slot registry substrate open slots onto synthesized contracts', () => {
    const state = service.build({
      risk: [{
        key: 'risk.falling_knife_guard',
        params: {},
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.risk[0].contracts?.[0]?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
        status: 'open',
        affectsExecution: true,
      }),
    ]))
  })

  it('synthesizes contracts for sequence, rebound and relative-volume atoms without generic contract prompts', () => {
    const state = service.build({
      triggers: [
        {
          key: 'condition.sequence',
          phase: 'entry',
          sideScope: 'long',
          params: {
            sequenceKind: 'consecutive_candles',
            count: 3,
            direction: 'down',
            groupId: 'entry-confirmation-1',
          },
        },
        {
          key: 'volume.relative_average',
          phase: 'entry',
          sideScope: 'long',
          status: 'open',
          params: {
            event: 'spike',
            comparator: 'gt',
            groupId: 'entry-confirmation-1',
          },
          openSlots: [{
            slotKey: 'trigger.volume.relative_average.lookback_bars',
            fieldPath: 'triggers[volume.relative_average].params.lookbackBars',
            status: 'open',
            priority: 'core',
            questionHint: '请确认放量比较窗口，例如过去 20 根 K 线均量。',
            affectsExecution: true,
          }],
        },
        {
          key: 'confirmation.rebound',
          phase: 'entry',
          sideScope: 'long',
          params: {
            groupId: 'entry-confirmation-1',
          },
        },
      ],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.sequence',
        status: 'locked',
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'price',
            verb: 'detect',
            object: 'sequence_condition',
          })],
        })],
      }),
      expect.objectContaining({
        key: 'volume.relative_average',
        status: 'open',
        openSlots: expect.arrayContaining([expect.objectContaining({
          slotKey: 'trigger.volume.relative_average.lookback_bars',
        })]),
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'market',
            verb: 'detect',
            object: 'volume_relative_average',
          })],
        })],
      }),
      expect.objectContaining({
        key: 'confirmation.rebound',
        status: 'locked',
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'price',
            verb: 'confirm',
            object: 'rebound',
          })],
        })],
      }),
    ]))
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
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
    expect(state?.trigger[1]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ valuePct: 3 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'price.percent_change', valuePct: 3 }),
        })],
      })],
    }))
    expect(state?.trigger[2]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ indicator: 'ma', fastPeriod: 20, slowPeriod: 50 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'indicator.cross_over', indicator: 'ma' }),
        })],
      })],
    }))
    expect(state?.trigger[3]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({ lookbackBars: 20, thresholdPct: 45 }),
      contracts: [expect.objectContaining({
        capabilities: [expect.objectContaining({
          shape: expect.objectContaining({ key: 'price.range_position_lte', lookbackBars: 20, thresholdPct: 45 }),
        })],
      })],
    }))
    expect(state?.action[0]).toEqual(expect.objectContaining({
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      source: 'user_explicit',
      openSlots: [expectContractRequiredSlot('triggers[0].contracts')],
    }))
    expect(state?.action[0]).toEqual(expect.objectContaining({
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[0].contracts')],
    }))
    expect(state?.trigger[1]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[1].contracts')],
    }))
    expect(state?.trigger[2]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[2].contracts')],
    }))
    expect(state?.trigger[3]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[3].contracts')],
    }))
    expect(state?.trigger[4]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[4].contracts')],
    }))
    expect(state?.trigger[5]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expectContractRequiredSlot('triggers[5].contracts')],
    }))
    expect(state?.trigger[6]).toEqual(expect.objectContaining({
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

    expect(state?.trigger[0]).toEqual(expect.objectContaining({
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

    expect(state?.action[0]).toEqual(expect.objectContaining({
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

    expect(state?.action[0]?.status).toBe('open')
    expect(state?.action[0]?.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        fieldPath: 'actions[0].params.orderType',
      }),
    ])
    expect(state?.action[0]?.contracts).toEqual([expect.objectContaining({ kind: 'action' })])
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

  it('normalizes structured symbol patch values with supported stablecoin quotes', () => {
    const state = service.build({
      contextSlots: {
        symbol: {
          value: 'BTCBUSD',
          source: 'user_explicit',
          evidenceText: 'BTC busd',
          base: 'BTC',
          quote: 'BUSD',
          quoteSource: 'explicit',
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

    expect(state?.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'BTCBUSD',
      status: 'locked',
      evidence: expect.objectContaining({
        text: 'BTC busd',
        source: 'user_explicit',
      }),
      contracts: expect.arrayContaining([
        expect.objectContaining({
          id: 'context-symbol-BTCBUSD',
          params: expect.objectContaining({
            symbol: 'BTCBUSD',
            base: 'BTC',
            quote: 'BUSD',
            source: 'user_explicit',
            quoteSource: 'explicit',
          }),
        }),
      ]),
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

    expect(state?.action[0]).toEqual(expect.objectContaining({
      key: 'open_long',
      status: 'open',
      source: 'user_explicit',
    }))
    expect(state?.action[0]?.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'action.order_type',
        status: 'open',
        questionHint: '请确认开仓订单类型。',
      }),
    ])
    expect(state?.action[0]?.contracts).toEqual([expect.objectContaining({ kind: 'action' })])
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
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
            shape: { kind: 'quote', value: 20, asset: 'USDT' },
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

    expect(state?.trigger[0]?.contracts).toEqual([
      expect.objectContaining({
        id: 'trigger-1',
        capabilities: [expect.objectContaining({ domain: 'price', verb: 'define', object: 'level_set' })],
      }),
    ])
    expect(state?.action[0]?.contracts).toEqual([
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
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    expect(state?.action[0]?.contracts).toBeUndefined()
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

    expect(state?.trigger).toHaveLength(3)
    expect(state?.risk).toHaveLength(2)
    for (const node of [...(state?.trigger ?? []), ...(state?.risk ?? [])]) {
      expect(node.openSlots).toEqual([])
      expect(node.contracts).toEqual(expect.arrayContaining([expect.objectContaining({
        capabilities: expect.any(Array),
      })]))
    }
    expect(state?.trigger[0]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volume_condition',
    }))
    expect(state?.trigger[1]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volume_condition',
    }))
    expect(state?.trigger[2]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'volatility_condition',
    }))
    expect(state?.risk[0]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'atr_stop',
    }))
    expect(state?.risk[1]?.contracts?.[0]?.capabilities[0]).toEqual(expect.objectContaining({
      object: 'partial_take_profit',
    }))
  })

  describe('memoryKey generation for risk.partial_take_profit', () => {
    const buildPtpSeed = (tiers: unknown[], sourceText: string) => ({
      triggers: [{
        id: 'trigger-entry',
        key: 'price.breakout_up',
        phase: 'entry',
        status: 'locked',
        source: 'user_explicit',
        params: { reference: 'resistance' },
        contracts: [{
          id: 'contract-entry',
          kind: 'trigger',
          capabilities: [{ domain: 'price', verb: 'detect', object: 'signal_condition', shape: {} }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      risk: [{
        id: 'risk-ptp',
        key: 'risk.partial_take_profit',
        status: 'locked',
        source: 'user_explicit',
        params: { tiers, sourceText },
      }],
    })

    it('assigns stable memoryKey to partial_take_profit risk seed', () => {
      const seed = buildPtpSeed(
        [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }, { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 }],
        '盈利5%平50%，盈利10%平50%',
      )
      const stateA = service.build(seed)
      const ptpRisk = stateA?.risk.find(r => r.key === 'risk.partial_take_profit')
      expect(ptpRisk?.params.memoryKey).toMatch(/^partial_tp_[a-f0-9]{16}$/)

      // idempotency: same input → same memoryKey
      const stateA2 = service.build(seed)
      const ptpRisk2 = stateA2?.risk.find(r => r.key === 'risk.partial_take_profit')
      expect(ptpRisk2?.params.memoryKey).toBe(ptpRisk?.params.memoryKey)
    })

    it('different sourceText produces different memoryKey', () => {
      const tiers = [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }]
      const stateA = service.build(buildPtpSeed(tiers, 'source-alpha'))
      const stateB = service.build(buildPtpSeed(tiers, 'source-beta'))
      const keyA = stateA?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      const keyB = stateB?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      expect(keyA).toMatch(/^partial_tp_[a-f0-9]{16}$/)
      expect(keyB).toMatch(/^partial_tp_[a-f0-9]{16}$/)
      expect(keyA).not.toBe(keyB)
    })

    it('different tiers produce different memoryKey', () => {
      const sourceText = 'same source'
      const stateA = service.build(buildPtpSeed(
        [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
        sourceText,
      ))
      const stateB = service.build(buildPtpSeed(
        [{ trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 }],
        sourceText,
      ))
      const keyA = stateA?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      const keyB = stateB?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      expect(keyA).not.toBe(keyB)
    })

    it('produces identical memoryKey regardless of tier insertion order', () => {
      const tiersA = [
        { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
        { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
      ]
      const tiersB = [
        { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
        { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
      ]
      const sourceText = 'same source'
      const keyA = service.build(buildPtpSeed(tiersA, sourceText))
        ?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      const keyB = service.build(buildPtpSeed(tiersB, sourceText))
        ?.risk.find(r => r.key === 'risk.partial_take_profit')?.params.memoryKey
      expect(keyA).toBeDefined()
      expect(keyA).toBe(keyB)
    })

    it('does not overwrite pre-existing memoryKey (idempotent round-trip)', () => {
      const existingKey = 'partial_tp_abcd1234'
      const state = service.build({
        triggers: [{
          id: 'trigger-entry',
          key: 'price.breakout_up',
          phase: 'entry',
          status: 'locked',
          source: 'user_explicit',
          params: { reference: 'resistance' },
          contracts: [{
            id: 'contract-entry',
            kind: 'trigger',
            capabilities: [{ domain: 'price', verb: 'detect', object: 'signal_condition', shape: {} }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        risk: [{
          id: 'risk-ptp',
          key: 'risk.partial_take_profit',
          status: 'locked',
          source: 'user_explicit',
          params: {
            tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
            sourceText: 'some text',
            memoryKey: existingKey,
          },
        }],
      })
      const ptpRisk = state?.risk.find(r => r.key === 'risk.partial_take_profit')
      expect(ptpRisk?.params.memoryKey).toBe(existingKey)
    })
  })

  // PR3.7 派生投影：单锚时回写 state.position.sizing
  it('PR3.7: projects single executionAnchored action budget into state.position.sizing', () => {
    const state = service.build({
      triggers: [{
        id: 'entry-rsi',
        key: 'indicator.rsi_oversold',
        phase: 'entry',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        params: { period: 14, threshold: 30 },
        openSlots: [],
      }],
      actions: [{
        id: 'open-long-dca',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'action-budget-contract',
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
      }],
    })

    // anchored 时 state.position 应由 projectSingleAnchorToPosition 填充 sizing
    expect(state?.position?.sizing).toEqual({ kind: 'quote', value: 100, asset: 'USDT' })
    expect(state?.position?.status).toBe('locked')
    expect(state?.position?.source).toBe('derived')
    // 没有 openSlots 占位
    expect(state?.position?.openSlots).toEqual([])
  })

  // PR3.9: 多锚时标记 isMultiLeg=true 并跳过 sizing 投影
  it('PR3.9: marks isMultiLeg=true and skips sizing projection when two actions each have per_order_budget', () => {
    const state = service.build({
      triggers: [{
        id: 'entry-on-start',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        openSlots: [],
      }],
      actions: [
        {
          id: 'open-long-leg1',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-leg1',
            kind: 'action',
            capabilities: [{
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: { kind: 'quote', value: 50, asset: 'USDT' },
            }],
            requires: [],
            params: {},
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        },
        {
          id: 'open-long-leg2',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-leg2',
            kind: 'action',
            capabilities: [{
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: { kind: 'quote', value: 80, asset: 'USDT' },
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

    // 多锚：不投影 sizing，isMultiLeg=true
    expect(state?.position?.sizing).toBeUndefined()
    expect(state?.isMultiLeg).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sub-fix 3: base_qty asset 字段投影启用
// ─────────────────────────────────────────────────────────────────────────────

describe('projectSingleAnchorToPosition — base_qty asset 投影', () => {
  const svc = new SemanticSeedStateBuilderService()

  function makeBaseQtyCapabilityState(asset: string | undefined): import('../../types/semantic-state').SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
      trigger: [],
      action: [{
        id: 'a-base',
        key: 'action.open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'contract-base',
          kind: 'action',
          capabilities: [{
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: asset !== undefined
              ? { kind: 'base', value: 0.001, asset }
              : { kind: 'base', value: 0.001 },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      risk: [],
      position: null,
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-05-11T00:00:00.000Z',
    }
  }

  it('base_qty + asset → 投影出 position.sizing = { kind: base, asset } + mode = fixed_qty', () => {
    // 直接构造已含 capability 的 state，走 projectSingleAnchorToPosition 路径
    const result = (svc as unknown as { projectSingleAnchorToPosition: (state: import('../../types/semantic-state').SemanticState, anchors: ReadonlyMap<string, import('../per-trade-sizing-resolver.service').SizingAnchor>) => import('../../types/semantic-state').SemanticState })
      .projectSingleAnchorToPosition(
        makeBaseQtyCapabilityState('BTC'),
        new Map([
          ['action:a-base', {
            scope: { kind: 'action', id: 'a-base' },
            executionAnchored: true,
            fullySpecified: true,
            normalized: { axis: 'base_qty', value: 0.001, needsRuntimeResolution: false, asset: 'BTC' },
            source: 'action',
          }],
        ]),
      )
    expect(result.position?.sizing).toEqual({ kind: 'base', value: 0.001, asset: 'BTC' })
    expect(result.position?.mode).toBe('fixed_qty')
  })

  it('base_qty 无 asset → 不投影（守门继续追问）', () => {
    const baseState = makeBaseQtyCapabilityState(undefined)
    const result = (svc as unknown as { projectSingleAnchorToPosition: (state: import('../../types/semantic-state').SemanticState, anchors: ReadonlyMap<string, import('../per-trade-sizing-resolver.service').SizingAnchor>) => import('../../types/semantic-state').SemanticState })
      .projectSingleAnchorToPosition(
        baseState,
        new Map([
          ['action:a-base', {
            scope: { kind: 'action', id: 'a-base' },
            executionAnchored: true,
            fullySpecified: true,
            normalized: { axis: 'base_qty', value: 0.001, needsRuntimeResolution: false },
            source: 'action',
          }],
        ]),
      )
    expect(result.position?.sizing).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1223: 出口 evidence invariant
// ─────────────────────────────────────────────────────────────────────────────

function makeService(mode: EvidenceInvariantMode): SemanticSeedStateBuilderService {
  return new SemanticSeedStateBuilderService(undefined, undefined, undefined, mode)
}

const MSG = '当收盘价在 EMA20 上方时开多，止损 2%'

describe('SemanticSeedStateBuilderService — evidence invariant (throw mode)', () => {
  const svc = makeService('throw')

  it('passes when all non-default atoms have evidence.text as message substring', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: 'EMA20 上方', source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).not.toThrow()
  })

  it('throws when trigger is missing evidence.text', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).toThrow(/evidence invariant violated/)
  })

  it('throws when trigger has evidence.text = empty string (C2)', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: '', source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).toThrow(/empty_string/)
  })

  it('throws when evidence.text is not a substring of message', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: '完全不相关文本', source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).toThrow(/not_substring/)
  })

  it('throws when action is missing evidence.text (action dimension)', () => {
    expect(() => svc.build({
      actions: [{
        key: 'open_long',
        source: 'user_explicit',
        // no evidence
      }],
    }, MSG)).toThrow(/evidence invariant violated/)
  })

  it('throws when risk is missing evidence.text (risk dimension)', () => {
    expect(() => svc.build({
      risk: [{
        key: 'stop_loss',
        source: 'user_explicit',
        // no evidence
      }],
    }, MSG)).toThrow(/evidence invariant violated/)
  })

  it('includes all violations in one throw message (multi-violation join)', () => {
    let error: Error | null = null
    try {
      svc.build({
        triggers: [{
          key: 'indicator.above',
          phase: 'entry',
          source: 'user_explicit',
          params: { indicator: 'ema', 'reference.period': 20 },
        }],
        actions: [{
          key: 'open_long',
          source: 'user_explicit',
        }],
      }, MSG)
    } catch (err) {
      error = err as Error
    }
    expect(error).not.toBeNull()
    expect(error?.message).toContain('trigger[0:indicator.above/entry]')
    expect(error?.message).toContain('action[0:open_long')
  })

  it('skips invariant when source === system_default', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'system_default',
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).not.toThrow()
  })

  it('skips invariant when message is not provided', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    })).not.toThrow()
  })

  it('throws when evidence.text is a non-string type (number)', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: 20, source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).toThrow(/evidence invariant violated/)
  })
})

describe('SemanticSeedStateBuilderService — evidence invariant (drop mode)', () => {
  const svc = makeService('drop')

  it('drops trigger with evidence.text that is not a message substring', () => {
    const state = svc.build({
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          source: 'user_explicit',
          evidence: { text: 'EMA20 上方', source: 'user_explicit' },
          params: { indicator: 'ema', 'reference.period': 20 },
        },
        {
          key: 'rsi.oversold',
          phase: 'entry',
          source: 'user_explicit',
          // evidence set but wrong (not a substring of MSG) — should be dropped
          evidence: { text: '完全不相关的文本', source: 'user_explicit' },
          params: { period: 14, threshold: 30 },
        },
      ],
    }, MSG)
    expect(state?.trigger).toHaveLength(1)
    expect(state?.trigger[0]?.key).toBe('indicator.above')
  })

  // Issue #1446: missing evidence.text 在 drop 模式不再 warn-only，与 empty_string / not_substring 一致被剔除
  it('drops trigger with missing evidence (#1446: warn-only carve-out removed)', () => {
    const state = svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        // no evidence — #1446 升级后也会被剔除
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)
    // missing-evidence atom 被 drop → state 退化为 null（无 atom 留存）
    expect(state).toBeNull()
  })

  it('drops trigger with empty evidence.text (C2)', () => {
    const state = svc.build({
      triggers: [{
        key: 'rsi.oversold',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: '', source: 'user_explicit' },
        params: { period: 14 },
      }],
      actions: [{
        key: 'open_long',
        source: 'user_explicit',
        evidence: { text: '开多', source: 'user_explicit' },
      }],
    }, '开多 RSI 超卖')
    expect(state?.trigger).toHaveLength(0)
  })

  it('returns null when all atoms are dropped (all have explicitly wrong evidence)', () => {
    const state = svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: '完全无关', source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)
    expect(state).toBeNull()
  })

  it('does not throw even when violations exist', () => {
    expect(() => svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        evidence: { text: '完全无关', source: 'user_explicit' },
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)).not.toThrow()
  })
})

describe('SemanticSeedStateBuilderService — evidence invariant (off mode)', () => {
  const svc = makeService('off')

  it('allows atoms without evidence when mode is off', () => {
    const state = svc.build({
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        source: 'user_explicit',
        params: { indicator: 'ema', 'reference.period': 20 },
      }],
    }, MSG)
    expect(state?.trigger).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1354：toActionState action.* 前缀剥离边界
// review M2/w1：补 isolated unit case，三条等价类锚定 boundary normalizer 语义
// ─────────────────────────────────────────────────────────────────────────────
describe('SemanticSeedStateBuilderService.toActionState — action.* 前缀归一化 (#1354)', () => {
  const svc = new SemanticSeedStateBuilderService()
  const MSG = 'unit-spec evidence carrier text，避免 evidence_invariant_drop'

  function buildPatchWithAction(actionKey: string): Record<string, unknown> {
    return {
      contextSlots: {
        symbol: { value: 'BTCUSDT', source: 'user_explicit' },
        timeframe: { value: '1h', source: 'user_explicit' },
      },
      actions: [{ key: actionKey, phase: 'entry', params: { orderType: 'market' }, evidence: { text: MSG, source: 'user_explicit' } }],
    }
  }

  it('"action.open_long" 剥前缀 → state.actions[0].key = "open_long"', () => {
    const state = svc.build(buildPatchWithAction('action.open_long'), MSG)
    expect(state?.action).toHaveLength(1)
    expect(state?.action[0]?.key).toBe('open_long')
  })

  it('"action.add_position" 不剥（非 lifecycle）→ 保留全 atom-key', () => {
    const state = svc.build(buildPatchWithAction('action.add_position'), MSG)
    expect(state?.action).toHaveLength(1)
    expect(state?.action[0]?.key).toBe('action.add_position')
  })

  it('"open_long" 已 unprefixed → idempotent 透传', () => {
    const state = svc.build(buildPatchWithAction('open_long'), MSG)
    expect(state?.action).toHaveLength(1)
    expect(state?.action[0]?.key).toBe('open_long')
  })

  it('"Action.OPEN_LONG" 大小写漂移 → lowercase 后剥前缀，存 "open_long"', () => {
    const state = svc.build(buildPatchWithAction('Action.OPEN_LONG'), MSG)
    expect(state?.action).toHaveLength(1)
    expect(state?.action[0]?.key).toBe('open_long')
  })

  // #1364 AC-3: patch.atoms[] 单数组 + 服务端按 contract.bucket 归桶
  describe('#1364 AC-3: patch.atoms[] dispatch by contract.bucket', () => {
    const builder = new SemanticSeedStateBuilderService()

    it('routes trigger atom by contract.bucket=trigger', () => {
      const state = builder.build({
        atoms: [{
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', timeframe: '15m', reference: { period: 50 } },
        }],
      })
      expect(state).not.toBeNull()
      expect(state!.trigger).toHaveLength(1)
      expect(state!.trigger[0].key).toBe('indicator.above')
      expect(state!.action).toHaveLength(0)
    })

    it('routes risk atom by contract.bucket=risk', () => {
      const state = builder.build({
        atoms: [{
          key: 'risk.partial_take_profit',
          params: { tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }] },
        }],
      })
      expect(state).not.toBeNull()
      expect(state!.risk).toHaveLength(1)
      expect(state!.risk[0].key).toBe('risk.partial_take_profit')
      expect(state!.trigger).toHaveLength(0)
    })

    it('routes positionConstraint atom to the top-level 5-bucket field and opens execution context slots', () => {
      const state = builder.build({
        atoms: [{
          key: 'grid.range_rebalance',
          params: {
            rangeLower: 60000,
            rangeUpper: 80000,
            sideMode: 'bidirectional',
            perOrderSizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
          },
        }],
      })

      expect(state).not.toBeNull()
      expect(state!.positionConstraint).toHaveLength(1)
      expect(state!.positionConstraint[0]).toEqual(expect.objectContaining({
        key: 'grid.range_rebalance',
      }))
      expect(state!.contextSlots.exchange?.status).toBe('open')
      expect(state!.contextSlots.symbol?.status).toBe('open')
      expect(state!.contextSlots.marketType?.status).toBe('open')
      expect(state!.contextSlots.timeframe?.status).toBe('open')
    })

    it('dedupes positionConstraint atoms when atoms[] and legacy mirrors carry the same semantic item', () => {
      const gridAtom = {
        key: 'grid.range_rebalance',
        params: {
          rangeLower: 60000,
          rangeUpper: 80000,
          sideMode: 'bidirectional',
          perOrderSizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        },
      }
      const state = builder.build({
        atoms: [gridAtom],
        actions: [gridAtom],
      })

      expect(state).not.toBeNull()
      expect(state!.positionConstraint).toHaveLength(1)
    })

    it('dedupes every positionConstraint bucket key when atoms[] and legacy mirrors carry the same semantic item', () => {
      const dcaAtom = {
        key: 'position.dca_schedule',
        params: {
          maxCount: 4,
          capitalCap: { kind: 'quote', value: 500, asset: 'USDT' },
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
          triggerMode: 'price_interval',
          exitRule: { rule: 'stop_below_previous_low' },
        },
      }
      const pyramidingAtom = {
        key: 'position.pyramiding_limit',
        params: {
          maxLayers: 3,
          layerSizing: { kind: 'ratio', value: 0.2, unit: 'ratio' },
        },
      }
      const state = builder.build({
        atoms: [dcaAtom, pyramidingAtom],
        actions: [dcaAtom, pyramidingAtom],
      })

      expect(state).not.toBeNull()
      expect(state!.positionConstraint.filter(item => item.key === 'position.dca_schedule')).toHaveLength(1)
      expect(state!.positionConstraint.filter(item => item.key === 'position.pyramiding_limit')).toHaveLength(1)
    })

    it('keeps bare numeric grid sizing as ratio rather than quote amount', () => {
      const state = builder.build({
        atoms: [{
          key: 'grid.range_rebalance',
          params: {
            rangeLower: 60000,
            rangeUpper: 80000,
            sideMode: 'bidirectional',
            perOrderSizing: 0.1,
          },
        }],
      })
      const budgetCapability = state?.positionConstraint[0]?.contracts
        ?.flatMap(contract => contract.capabilities)
        .find(capability =>
          capability.domain === 'capital'
          && capability.verb === 'allocate'
          && capability.object === 'per_order_budget',
        )

      expect(budgetCapability?.shape).toEqual(expect.objectContaining({
        kind: 'ratio',
        value: 0.1,
        unit: 'ratio',
      }))
    })

    it('drops unknown atom key with warn', () => {
      const state = builder.build({
        atoms: [{ key: 'completely.unknown.atom.key', params: {} }],
      })
      // No buckets populated -> build returns null
      expect(state).toBeNull()
    })

    it('coexists with legacy 5-bucket fields in same patch', () => {
      const state = builder.build({
        atoms: [{
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', timeframe: '15m', reference: { period: 20 } },
        }],
        risk: [{
          key: 'risk.partial_take_profit',
          params: { tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }] },
        }],
      })
      expect(state).not.toBeNull()
      expect(state!.trigger).toHaveLength(1)
      expect(state!.risk).toHaveLength(1)
    })
  })
})
