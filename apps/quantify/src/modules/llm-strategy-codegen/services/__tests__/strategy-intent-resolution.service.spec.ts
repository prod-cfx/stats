import { StrategyIntentResolutionService } from '../strategy-intent-resolution.service'

describe('strategyIntentResolutionService', () => {
  const service = new StrategyIntentResolutionService()

  it('prioritizes signal ambiguities above context ambiguities', () => {
    const resolution = service.resolve({
      normalizedIntent: {
        families: ['single-leg'],
        triggers: [
          {
            key: 'indicator.above',
            phase: 'entry',
            params: { indicator: 'ma', referenceRole: 'long_term' },
            closureStatus: 'open',
            unresolvedSlots: [
              {
                slotKey: 'reference.period',
                fieldPath: 'triggers[0].params.reference.period',
                reason: 'missing_required_param',
                questionHint: '长期均线是多少？',
                priority: 'core',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_ratio',
          value: 0,
          positionMode: 'long_short',
          closureStatus: 'open',
          unresolvedSlots: [
            {
              slotKey: 'position.value',
              fieldPath: 'position.value',
              reason: 'missing_required_param',
              questionHint: '单笔仓位是多少？',
              priority: 'context',
              affectsExecution: true,
            },
          ],
        },
        normalizationNotes: [],
      } as any,
    })

    expect(resolution.nextQuestion).toEqual(expect.objectContaining({
      lane: 'signal',
      slotKey: 'reference.period',
    }))
    expect(resolution.ambiguities[1]).toEqual(expect.objectContaining({
      lane: 'context',
    }))
  })
})
