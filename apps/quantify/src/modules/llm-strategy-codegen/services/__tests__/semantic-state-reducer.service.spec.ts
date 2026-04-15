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
      answer: 'MA50',
      messageIndex: 4,
    })

    expect(next.triggers[0]?.params['reference.period']).toBe(50)
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'reference.period.entry')?.status).toBe('locked')
    expect(next.triggers[0]?.openSlots.find(slot => slot.slotKey === 'confirmationMode.entry')?.status).toBe('open')
  })
})
