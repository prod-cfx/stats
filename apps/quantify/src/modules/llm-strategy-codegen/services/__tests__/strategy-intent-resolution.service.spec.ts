import { buildSemanticSlotId } from '../../types/semantic-state'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'
import { StrategyIntentResolutionService } from '../strategy-intent-resolution.service'

describe('strategyIntentResolutionService', () => {
  const service = new StrategyIntentResolutionService()
  const normalizer = new StrategyIntentNormalizerService()

  it('resolves the fixed-range grid case into one executable interpretation', () => {
    const resolution = service.resolve({
      normalizedIntent: {
        families: ['grid.range_rebalance'],
        triggers: [],
        actions: [],
        risk: [],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' } as any,
        grid: {
          family: 'grid.range_rebalance',
          range: { lower: 60000, upper: 80000 },
          stepPct: 0.5,
          sideMode: 'bidirectional',
          recycle: true,
        } as any,
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
            closureStatus: 'closed',
            unresolvedSlots: [],
          },
        ],
        actions: [{ key: 'open_short' } as any],
        risk: [],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' } as any,
        unresolved: [],
        normalizationNotes: [],
      },
    })

    expect(resolution.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atomic_semantic_fork', field: 'trigger.confirmation' }),
    ]))
  })

  it('keeps mixed Bollinger touch-plus-close wording ambiguous through the normalizer heuristic path', () => {
    const normalized = normalizer.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['触及布林上轨后收盘确认做空'],
      exitRules: ['收盘回到布林中轨平空'],
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 8 },
    } as any)

    const resolution = service.resolve({
      normalizedIntent: normalized.normalizedIntent,
    })

    expect(normalized.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        resolutionHints: expect.objectContaining({
          confirmation: 'ambiguous_touch_or_close_confirm',
        }),
      }),
    ]))
    expect(resolution.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atomic_semantic_fork', field: 'trigger.confirmation' }),
    ]))
  })

  it('propagates stable semantic slot identity into open-slot ambiguities', () => {
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
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                reason: 'missing_required_param',
                questionHint: '长期均线是多少？',
                priority: 'core',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [{ key: 'open_long' } as any],
        risk: [],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' } as any,
        unresolved: [],
        normalizationNotes: [],
      },
    })

    expect(resolution.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'open_semantic_slot',
        field: 'reference.period.entry',
        slotKey: 'reference.period.entry',
        fieldPath: 'triggers[0].params.reference.period',
        slotId: buildSemanticSlotId({
          slotKey: 'reference.period.entry',
          fieldPath: 'triggers[0].params.reference.period',
        }),
      }),
    ]))
  })
})
