import { buildAccountStrategyMixedTimeline } from './account-strategy-view-detail-projection'

describe('buildAccountStrategyMixedTimeline', () => {
  it('keeps the newest 30 events while preserving chronological display order', () => {
    const timeline = buildAccountStrategyMixedTimeline({
      instance: null,
      subscription: null,
      signalExecutions: Array.from({ length: 35 }, (_, index) => ({
        createdAt: new Date(Date.UTC(2026, 2, 20, 10, index)),
        status: 'SUCCESS',
        errorMessage: null,
      })),
      trades: [],
    })

    expect(timeline).toHaveLength(30)
    expect(timeline[0].at).toBe('2026-03-20T10:05:00.000Z')
    expect(timeline[29].at).toBe('2026-03-20T10:34:00.000Z')
  })
})
