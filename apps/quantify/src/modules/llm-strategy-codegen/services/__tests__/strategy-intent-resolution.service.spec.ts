import { StrategyIntentResolutionService } from '../strategy-intent-resolution.service'

describe('strategyIntentResolutionService', () => {
  const service = new StrategyIntentResolutionService()

  it('resolves the fixed-range grid case into one executable interpretation', () => {
    const resolution = service.resolve({
      normalizedIntent: {
        families: ['grid.range_rebalance'],
        triggers: [],
        actions: [],
        risk: [],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
        grid: {
          family: 'grid.range_rebalance',
          range: { lower: 60000, upper: 80000 },
          stepPct: 0.5,
          sideMode: 'bidirectional',
          recycle: true,
        },
        unresolved: [],
        normalizationNotes: [],
      },
    })

    expect(resolution.ambiguities).toEqual([])
    expect(resolution.atomicIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'grid_touch' }),
    ]))
  })

  it('keeps Bollinger trigger semantics ambiguous when the normalized input cannot distinguish touch vs close confirmation', () => {
    const resolution = service.resolve({
      normalizedIntent: {
        families: ['single-leg'],
        triggers: [
          {
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
            params: { band: 'upper' },
          },
        ],
        actions: [{ key: 'open_short' }],
        risk: [],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
        unresolved: [],
        normalizationNotes: [],
      },
    })

    expect(resolution.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atomic_semantic_fork', field: 'trigger.confirmation' }),
    ]))
  })
})
