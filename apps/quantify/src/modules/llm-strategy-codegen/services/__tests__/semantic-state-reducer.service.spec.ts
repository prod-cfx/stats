import { buildSemanticSlotId, type SemanticState } from '../../types/semantic-state'
import { SemanticStateReducerService } from '../semantic-state-reducer.service'

describe('SemanticStateReducerService', () => {
  const service = new SemanticStateReducerService()

  it('normalizes english contract clarification answers into perp market type', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'context.marketType',
            status: 'open',
            priority: 'context',
            questionHint: '请确认市场类型（现货或合约/perp）。',
            affectsExecution: true,
          },
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'marketType',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'marketType',
        fieldPath: 'context.marketType',
      }),
      answer: 'contract',
      messageIndex: 2,
    })

    expect(next.contextSlots.marketType).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'perp',
    }))
  })

  it('locks the clarified MA period slot without reopening unrelated slots', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: { indicator: 'ma', referenceRole: 'long_term' },
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
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'reference.period.entry',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'reference.period.entry',
        fieldPath: 'triggers[0].params.reference.period',
      }),
      answer: 'MA50',
      messageIndex: 4,
    })

    expect(next.triggers[0]?.params['reference.period']).toBe(50)
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'reference.period.entry')?.status).toBe('locked')
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'confirmationMode.entry')?.status).toBe('open')
  })

  it('locks the confirmation slot with the semantic confirmation value instead of inheriting reference period', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
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
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
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
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'confirmationMode.entry',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'confirmationMode.entry',
        fieldPath: 'triggers[0].params.confirmationMode',
      }),
      answer: '收盘确认',
      messageIndex: 5,
    })

    expect(next.triggers[0]?.params.confirmationMode).toBe('close_confirm')
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'confirmationMode.entry')).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'close_confirm',
    }))
  })

  it('locks a fixed quote answer for an open position sizing slot', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_ratio',
          value: 0,
          positionMode: 'long_only',
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'position.sizing',
              fieldPath: 'position.value',
              status: 'open',
              priority: 'risk',
              questionHint: '请确认单笔仓位大小（例如 10% 或 10 USDT）。',
              affectsExecution: true,
            },
          ],
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'position.sizing',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'position.sizing',
        fieldPath: 'position.value',
      }),
      answer: '固定使用 10 USDT',
      messageIndex: 6,
    })

    expect(next.position).toEqual(expect.objectContaining({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      status: 'locked',
      source: 'user_explicit',
    }))
    expect(next.position?.openSlots?.[0]).toEqual(expect.objectContaining({
      value: '10 USDT',
      status: 'locked',
    }))
  })

  it.each([
    ['10u', { kind: 'quote', value: 10, asset: 'USDT' }, 'fixed_quote', 10, '10 USDT'],
    ['10刀', { kind: 'quote', value: 10, asset: 'USD' }, 'fixed_quote', 10, '10 USD'],
    ['0.001 BTC', { kind: 'base', value: 0.001, asset: 'BTC' }, 'fixed_qty', 0.001, '0.001 BTC'],
  ] as const)(
    'locks position sizing contract answers from clarification reduction: %s',
    (answer, sizing, mode, value, slotValue) => {
      const next = service.applyClarificationAnswer({
        currentState: {
          version: 1,
          families: ['single-leg'],
          triggers: [],
          actions: [],
          risk: [],
          position: {
            mode: 'fixed_ratio',
            value: 0,
            positionMode: 'long_only',
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'position.sizing',
                fieldPath: 'position.value',
                status: 'open',
                priority: 'risk',
                questionHint: '请确认单笔仓位大小（例如 10% 或 10 USDT）。',
                affectsExecution: true,
              },
            ],
          },
          contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
          normalizationNotes: [],
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
        targetSlotKey: 'position.sizing',
        targetSlotId: buildSemanticSlotId({
          slotKey: 'position.sizing',
          fieldPath: 'position.value',
        }),
        answer,
        messageIndex: 19,
      })

      expect(next.position).toEqual(expect.objectContaining({
        sizing,
        mode,
        value,
        status: 'locked',
        source: 'user_explicit',
        evidence: {
          text: answer,
          messageIndex: 19,
          source: 'user_explicit',
        },
      }))
      expect(next.position?.openSlots?.[0]).toEqual(expect.objectContaining({
        value: slotValue,
        status: 'locked',
        evidence: {
          text: answer,
          messageIndex: 19,
          source: 'user_explicit',
        },
      }))
    },
  )

  it('keeps a confirmation slot open when the answer does not normalize to a canonical confirmation mode', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
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
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
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
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'confirmationMode.entry',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'confirmationMode.entry',
        fieldPath: 'triggers[0].params.confirmationMode',
      }),
      answer: '看情况',
      messageIndex: 6,
    })

    expect(next.triggers[0]?.params.confirmationMode).toBeUndefined()
    expect(next.triggers[0]?.status).toBe('open')
    const confirmationSlot = next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'confirmationMode.entry')
    expect(confirmationSlot).toEqual(expect.objectContaining({
      status: 'open',
    }))
    expect(confirmationSlot).not.toHaveProperty('value')
    expect(confirmationSlot).not.toHaveProperty('evidence')
  })

  it('reduces only the targeted slot when multiple triggers share the same slot key', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma-fast',
            key: 'indicator.above',
            phase: 'entry',
            params: { indicator: 'ma', referenceRole: 'short_term' },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '短期突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
          {
            id: 'entry-ma-slow',
            key: 'indicator.above',
            phase: 'entry',
            params: { indicator: 'ma', referenceRole: 'long_term' },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[1].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '长期突破按收盘确认还是盘中触发？',
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
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'confirmationMode.entry',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'confirmationMode.entry',
        fieldPath: 'triggers[1].params.confirmationMode',
      }),
      answer: '收盘确认',
      messageIndex: 7,
    })

    expect(next.triggers[0]?.params.confirmationMode).toBeUndefined()
    expect(next.triggers[0]?.status).toBe('open')
    expect(next.triggers[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'open',
    }))
    expect(next.triggers[0]?.openSlots[0]).not.toHaveProperty('value')

    expect(next.triggers[1]?.params.confirmationMode).toBe('close_confirm')
    expect(next.triggers[1]?.status).toBe('locked')
    expect(next.triggers[1]?.openSlots[0]).toEqual(expect.objectContaining({
      fieldPath: 'triggers[1].params.confirmationMode',
      status: 'locked',
      value: 'close_confirm',
    }))
  })

  it('normalizes 收盘后触发 as close confirmation instead of touch', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
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
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
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
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      targetSlotKey: 'confirmationMode.entry',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'confirmationMode.entry',
        fieldPath: 'triggers[0].params.confirmationMode',
      }),
      answer: '收盘后触发',
      messageIndex: 8,
    })

    expect(next.triggers[0]?.params.confirmationMode).toBe('close_confirm')
    expect(next.triggers[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'close_confirm',
    }))
  })

  it('reduces grid slots into trigger params and keeps remaining grid slots open', () => {
    const baseState: SemanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: {
            sideMode: 'bidirectional',
            breakoutAction: 'pause',
          },
          status: 'open',
          source: 'user_explicit' as const,
          openSlots: [
            {
              slotKey: 'grid.range.lower',
              fieldPath: 'triggers[0].params.rangeLower',
              status: 'open' as const,
              priority: 'core' as const,
              questionHint: '请确认网格区间下界。',
              affectsExecution: true,
            },
            {
              slotKey: 'grid.range.upper',
              fieldPath: 'triggers[0].params.rangeUpper',
              status: 'open' as const,
              priority: 'core' as const,
              questionHint: '请确认网格区间上界。',
              affectsExecution: true,
            },
            {
              slotKey: 'grid.stepPct',
              fieldPath: 'triggers[0].params.stepPct',
              status: 'open' as const,
              priority: 'core' as const,
              questionHint: '请确认每格步长（例如 0.5%）。',
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
    }

    const withLower = service.applyClarificationAnswer({
      currentState: baseState,
      targetSlotKey: 'grid.range.lower',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'grid.range.lower',
        fieldPath: 'triggers[0].params.rangeLower',
      }),
      answer: '60000',
      messageIndex: 9,
    })
    const withUpper = service.applyClarificationAnswer({
      currentState: withLower,
      targetSlotKey: 'grid.range.upper',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'grid.range.upper',
        fieldPath: 'triggers[0].params.rangeUpper',
      }),
      answer: '80000',
      messageIndex: 10,
    })
    const withStep = service.applyClarificationAnswer({
      currentState: withUpper,
      targetSlotKey: 'grid.stepPct',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'grid.stepPct',
        fieldPath: 'triggers[0].params.stepPct',
      }),
      answer: '0.5%',
      messageIndex: 11,
    })

    expect(withLower.triggers[0]?.params.rangeLower).toBe(60000)
    expect(withLower.triggers[0]?.openSlots.find(slot => slot.slotKey === 'grid.range.lower')).toEqual(expect.objectContaining({
      status: 'locked',
      value: 60000,
    }))
    expect(withLower.triggers[0]?.openSlots.find(slot => slot.slotKey === 'grid.range.upper')?.status).toBe('open')

    expect(withUpper.triggers[0]?.params.rangeUpper).toBe(80000)
    expect(withUpper.triggers[0]?.openSlots.find(slot => slot.slotKey === 'grid.range.upper')).toEqual(expect.objectContaining({
      status: 'locked',
      value: 80000,
    }))

    expect(withStep.triggers[0]?.params.stepPct).toBe(0.5)
    expect(withStep.triggers[0]?.openSlots.find(slot => slot.slotKey === 'grid.stepPct')).toEqual(expect.objectContaining({
      status: 'locked',
      value: 0.5,
    }))
    expect(withStep.triggers[0]?.status).toBe('locked')
  })

  it('treats legacy grid.lower and grid.upper slots as canonical grid range semantics', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              sideMode: 'bidirectional',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'grid.lower',
                fieldPath: 'triggers[0].params.rangeLower',
                status: 'open',
                priority: 'core',
                questionHint: '请确认网格区间下界。',
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
      targetSlotKey: 'grid.lower',
      targetFieldPath: 'triggers[0].params.rangeLower',
      answer: '60000',
      messageIndex: 12,
    })

    expect(next.triggers[0]?.params.rangeLower).toBe(60000)
    expect(next.triggers[0]?.openSlots[0]).toEqual(expect.objectContaining({
      slotKey: 'grid.lower',
      status: 'locked',
      value: 60000,
    }))
    expect(next.triggers[0]?.status).toBe('locked')
  })

  it('reduces grid sideMode into trigger params and locks the semantic slot', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
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
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'grid.sideMode',
                fieldPath: 'triggers[0].params.sideMode',
                status: 'open',
                priority: 'core',
                questionHint: '请确认网格方向（双向 / 只做多 / 只做空）。',
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
      targetSlotKey: 'grid.sideMode',
      targetFieldPath: 'triggers[0].params.sideMode',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'grid.sideMode',
        fieldPath: 'triggers[0].params.sideMode',
      }),
      answer: '只做多',
      messageIndex: 12,
    })

    expect(next.triggers[0]?.params.sideMode).toBe('long_only')
    expect(next.triggers[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'long_only',
    }))
    expect(next.triggers[0]?.status).toBe('locked')
  })

  it('accepts natural short-grid sideMode wording in semantic reduction', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
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
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'grid.sideMode',
                fieldPath: 'triggers[0].params.sideMode',
                status: 'open',
                priority: 'core',
                questionHint: '请确认网格方向（双向 / 只做多 / 只做空）。',
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
      targetSlotKey: 'grid.sideMode',
      targetFieldPath: 'triggers[0].params.sideMode',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'grid.sideMode',
        fieldPath: 'triggers[0].params.sideMode',
      }),
      answer: '空头网格',
      messageIndex: 13,
    })

    expect(next.triggers[0]?.params.sideMode).toBe('short_only')
    expect(next.triggers[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'short_only',
    }))
  })

  it.each([
    '10%',
    '百分之10',
    '百分10',
    '百分之十',
    '10',
    '价格下跌 1% 时用 10% 仓位开多',
    '用 10% 仓位，止损 5%',
  ])(
    'locks position sizing from a semantic clarification answer: %s',
    (answer) => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_fraction',
          value: 0,
          positionMode: 'one_way',
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'position.sizing',
              fieldPath: 'position.value',
              status: 'open',
              priority: 'core',
              questionHint: '请确认每次使用多少仓位。',
              affectsExecution: true,
            },
          ],
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'position.sizing',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'position.sizing',
        fieldPath: 'position.value',
      }),
      answer,
      messageIndex: 14,
    })

    expect(next.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      status: 'locked',
      source: 'user_explicit',
    }))
    expect(next.position?.openSlots?.[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: '10%',
      evidence: {
        text: answer,
        messageIndex: 14,
        source: 'user_explicit',
      },
    }))
    },
  )

  it('locks position sizing from a full-width percent answer', () => {
    const answer = '10％'

    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_fraction',
          value: 0,
          positionMode: 'one_way',
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'position.sizing',
              fieldPath: 'position.value',
              status: 'open',
              priority: 'core',
              questionHint: '请确认每次使用多少仓位。',
              affectsExecution: true,
            },
          ],
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'position.sizing',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'position.sizing',
        fieldPath: 'position.value',
      }),
      answer,
      messageIndex: 18,
    })

    expect(next.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      status: 'locked',
      source: 'user_explicit',
    }))
    expect(next.position?.openSlots?.[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: '10%',
      evidence: {
        text: answer,
        messageIndex: 18,
        source: 'user_explicit',
      },
    }))
  })

  it.each([
    '止损 5%',
    '止损 5% 用市价平仓',
    '资金费率达到 0.1% 开多',
    '资金费率达到 0.1% 用市价开多',
    '价格上涨 1% 时开多',
    '价格上涨 1% 时用市价开多',
  ])(
    'keeps position sizing open when clarification answer is semantic trigger/risk percentage: %s',
    (answer) => {
      const next = service.applyClarificationAnswer({
        currentState: {
          version: 1,
          families: ['single-leg'],
          triggers: [],
          actions: [],
          risk: [],
          position: {
            mode: 'fixed_ratio',
            value: 0,
            positionMode: 'long_only',
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'position.sizing',
                fieldPath: 'position.value',
                status: 'open',
                priority: 'core',
                questionHint: '请确认每次使用多少仓位。',
                affectsExecution: true,
              },
            ],
          },
          contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
          normalizationNotes: [],
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
        targetSlotKey: 'position.sizing',
        targetSlotId: buildSemanticSlotId({
          slotKey: 'position.sizing',
          fieldPath: 'position.value',
        }),
        answer,
        messageIndex: 20,
      })

      expect(next.position).toEqual(expect.objectContaining({
        mode: 'fixed_ratio',
        value: 0,
        status: 'open',
        source: 'derived',
      }))
      expect(next.position).not.toHaveProperty('sizing')
      expect(next.position).not.toHaveProperty('evidence')
      expect(next.position?.openSlots?.[0]).toEqual(expect.objectContaining({
        status: 'open',
      }))
      expect(next.position?.openSlots?.[0]).not.toHaveProperty('value')
      expect(next.position?.openSlots?.[0]).not.toHaveProperty('evidence')
    },
  )

  it('turns a protective risk clarification answer into a locked stop-loss risk atom', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [
          {
            id: 'protective-exit',
            key: 'risk.protective_exit',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.protective_exit',
                fieldPath: 'risk[0].params.valuePct',
                status: 'open',
                priority: 'risk',
                questionHint: '请确认保护性退出条件。',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '亏损 5% 止损',
      messageIndex: 15,
    })

    expect(next.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: {
        valuePct: 5,
        basis: 'entry_avg_price',
      },
      status: 'locked',
      source: 'user_explicit',
    }))
    expect(next.risk[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: 5,
      evidence: {
        text: '亏损 5% 止损',
        messageIndex: 15,
        source: 'user_explicit',
      },
    }))
  })

  it('turns a full-width protective risk clarification answer into a locked stop-loss risk atom', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [
          {
            id: 'protective-exit',
            key: 'risk.protective_exit',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.protective_exit',
                fieldPath: 'risk[0].params.valuePct',
                status: 'open',
                priority: 'risk',
                questionHint: '请确认保护性退出条件。',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '亏损 5％ 止损',
      messageIndex: 19,
    })

    expect(next.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: {
        valuePct: 5,
        basis: 'entry_avg_price',
      },
      status: 'locked',
      source: 'user_explicit',
    }))
    expect(next.risk[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'locked',
      value: 5,
      evidence: {
        text: '亏损 5％ 止损',
        messageIndex: 19,
        source: 'user_explicit',
      },
    }))
  })

  it('maps protective risk clarification answers to explicit canonical risk atoms', () => {
    const buildState = (): SemanticState => ({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [
        {
          id: 'protective-exit',
          key: 'risk.protective_exit',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'risk.protective_exit',
              fieldPath: 'risk[0].params.valuePct',
              status: 'open',
              priority: 'risk',
              questionHint: '请确认保护性退出条件。',
              affectsExecution: true,
            },
          ],
        },
      ],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })

    const maxDrawdown = service.applyClarificationAnswer({
      currentState: buildState(),
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '最大回撤 12%',
    })
    const maxSingleLoss = service.applyClarificationAnswer({
      currentState: buildState(),
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '单笔最大亏损 3%',
    })

    expect(maxDrawdown.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.max_drawdown_pct',
      params: expect.objectContaining({ valuePct: 12 }),
      status: 'locked',
    }))
    expect(maxSingleLoss.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.max_single_loss_pct',
      params: expect.objectContaining({ valuePct: 3 }),
      status: 'locked',
    }))
  })

  it('keeps percent clarification slots open when answers are not parseable percentages', () => {
    const positionState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [],
      position: {
        mode: 'fixed_fraction',
        value: 0,
        positionMode: 'one_way',
        status: 'open',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.value',
            status: 'open',
            priority: 'core',
            questionHint: '请确认每次使用多少仓位。',
            affectsExecution: true,
          },
        ],
      },
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }
    const riskState: SemanticState = {
      ...positionState,
      risk: [
        {
          id: 'protective-exit',
          key: 'risk.protective_exit',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'risk.protective_exit',
              fieldPath: 'risk[0].params.valuePct',
              status: 'open',
              priority: 'risk',
              questionHint: '请确认保护性退出条件。',
              affectsExecution: true,
            },
          ],
        },
      ],
      position: null,
    }

    for (const answer of ['看情况', '0', '0%', '150', '150%', '-10', '-10%', '不是10%', '5% 或 10%', '仓位 5% 或 10%', '用 5% 或 10% 仓位']) {
      const afterPositionAnswer = service.applyClarificationAnswer({
        currentState: positionState,
        targetSlotKey: 'position.sizing',
        targetSlotId: buildSemanticSlotId({
          slotKey: 'position.sizing',
          fieldPath: 'position.value',
        }),
        answer,
        messageIndex: 16,
      })
      const afterRiskAnswer = service.applyClarificationAnswer({
        currentState: riskState,
        targetSlotKey: 'risk.protective_exit',
        targetSlotId: buildSemanticSlotId({
          slotKey: 'risk.protective_exit',
          fieldPath: 'risk[0].params.valuePct',
        }),
        answer,
        messageIndex: 17,
      })

      expect(afterPositionAnswer.position).toEqual(expect.objectContaining({
        value: 0,
        status: 'open',
        source: 'derived',
      }))
      expect(afterPositionAnswer.position?.openSlots?.[0]).toEqual(expect.objectContaining({
        status: 'open',
      }))
      expect(afterPositionAnswer.position?.openSlots?.[0]).not.toHaveProperty('value')
      expect(afterPositionAnswer.position?.openSlots?.[0]).not.toHaveProperty('evidence')

      expect(afterRiskAnswer.risk[0]).toEqual(expect.objectContaining({
        key: 'risk.protective_exit',
        params: {},
        status: 'open',
        source: 'derived',
      }))
      expect(afterRiskAnswer.risk[0]?.openSlots[0]).toEqual(expect.objectContaining({
        status: 'open',
      }))
      expect(afterRiskAnswer.risk[0]?.openSlots[0]).not.toHaveProperty('value')
      expect(afterRiskAnswer.risk[0]?.openSlots[0]).not.toHaveProperty('evidence')
    }
  })

  it('keeps protective risk open when a percent answer lacks risk semantics', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [
          {
            id: 'protective-exit',
            key: 'risk.protective_exit',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.protective_exit',
                fieldPath: 'risk[0].params.valuePct',
                status: 'open',
                priority: 'risk',
                questionHint: '请确认保护性退出条件。',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '5%',
    })

    expect(next.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.protective_exit',
      status: 'open',
      params: {},
    }))
    expect(next.risk[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'open',
    }))
  })

  it('keeps trailing-stop answers open until that risk is canonical-compilable', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [
          {
            id: 'protective-exit',
            key: 'risk.protective_exit',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.protective_exit',
                fieldPath: 'risk[0].params.valuePct',
                status: 'open',
                priority: 'risk',
                questionHint: '请确认保护性退出条件。',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'risk.protective_exit',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.valuePct',
      }),
      answer: '移动止损 5%',
    })

    expect(next.risk[0]).toEqual(expect.objectContaining({
      key: 'risk.protective_exit',
      status: 'open',
      params: {},
    }))
    expect(next.risk[0]?.openSlots[0]).toEqual(expect.objectContaining({
      status: 'open',
    }))
  })

  it('does not treat standalone 非 as percent-answer negation', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_fraction',
          value: 0,
          positionMode: 'one_way',
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'position.sizing',
              fieldPath: 'position.value',
              status: 'open',
              priority: 'core',
              questionHint: '请确认每次使用多少仓位。',
              affectsExecution: true,
            },
          ],
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      targetSlotKey: 'position.sizing',
      targetSlotId: buildSemanticSlotId({
        slotKey: 'position.sizing',
        fieldPath: 'position.value',
      }),
      answer: '非常保守，5%',
    })

    expect(next.position).toEqual(expect.objectContaining({
      value: 0.05,
      status: 'locked',
      source: 'user_explicit',
    }))
  })

  it('locks trigger reference definition slots from clarification answers', () => {
    const next = service.applyClarificationAnswer({
      currentState: {
        version: 1,
        families: [],
        triggers: [{
          id: 'trigger-open-breakout',
          key: 'price.breakout_up',
          phase: 'entry',
          sideScope: 'long',
          params: { reference: 'unknown' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'trigger.reference_definition',
            fieldPath: 'triggers[0].params.reference',
            status: 'open',
            priority: 'core',
            questionHint: '请确认关键位置如何定义。',
            affectsExecution: true,
          }],
        }],
        actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
      targetSlotKey: 'trigger.reference_definition',
      targetFieldPath: 'triggers[0].params.reference',
      answer: '最近 20 根 K 线高点',
    })

    expect(next.triggers[0]).toEqual(expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({
        reference: 'channel_high',
        period: 20,
      }),
    }))
  })
})
