import { SemanticStateReducerService } from '../semantic-state-reducer.service'

describe('SemanticStateReducerService', () => {
  const service = new SemanticStateReducerService()

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
      targetFieldPath: 'triggers[0].params.reference.period',
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
      targetFieldPath: 'triggers[0].params.confirmationMode',
      answer: '收盘确认',
      messageIndex: 5,
    })

    expect(next.triggers[0]?.params.confirmationMode).toBe('close_confirm')
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'confirmationMode.entry')).toEqual(expect.objectContaining({
      status: 'locked',
      value: 'close_confirm',
    }))
  })

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
      targetFieldPath: 'triggers[0].params.confirmationMode',
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
      targetFieldPath: 'triggers[1].params.confirmationMode',
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
})
