import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyIrCanonicalizerService } from '../canonical-strategy-ir-canonicalizer.service'

describe('canonicalStrategyIrCanonicalizerService', () => {
  it('sorts semantically identical IR into a stable canonical order', () => {
    const service = new CanonicalStrategyIrCanonicalizerService()

    const ir: CanonicalStrategyIrV1 = {
      irVersion: 'csi.v1',
      source: {
        graphVersion: 18,
        graphDigest: 'sha256:graph',
        specHash: 'sha256:graph',
      },
      market: {
        venue: 'binance',
        instrumentType: 'spot',
        symbol: 'BTCUSDT',
        timeframes: ['1h'],
        priceFeed: 'close',
      },
      portfolio: {
        positionMode: 'long_only',
        sizing: { mode: 'pct_equity', value: 25 },
        maxConcurrentPositions: 1,
        allowPyramiding: false,
        maxPyramidingLayers: 1,
      },
      dataRequirements: {
        warmupBars: 21,
        maxLookback: 21,
        requiredTimeframes: ['1h'],
      },
      signalCatalog: {
        series: [
          { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
          { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
          { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
        ],
        levelSets: [],
        predicates: [
          { id: 'exit_cross', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
          { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
        ],
      },
      ruleBlocks: [
        {
          id: 'exit_long',
          phase: 'exit',
          when: 'exit_cross',
          priority: 100,
          actions: [{ kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } }],
        },
        {
          id: 'entry_long',
          phase: 'entry',
          when: 'entry_cross',
          priority: 200,
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } }],
        },
      ],
      orderPrograms: [],
      riskPolicy: {
        guards: [
          { id: 'stop_loss_4', kind: 'STOP_LOSS_PCT', scope: 'position', value: 4, onBreach: 'FORCE_EXIT' },
        ],
      },
      executionPolicy: {
        signalEvaluation: 'bar_close',
        fillPolicy: 'next_bar_open',
        timeframeAlignment: 'strict',
        orderTypeDefault: 'market',
        timeInForce: 'gtc',
        allowPartialFill: false,
      },
    }

    const canonical = service.canonicalize(ir)

    expect(canonical.signalCatalog.series.map(item => item.id)).toEqual(['close_1h', 'ema_21', 'ema_7'])
    expect(canonical.signalCatalog.predicates.map(item => item.id)).toEqual(['entry_cross', 'exit_cross'])
    expect(canonical.ruleBlocks.map(item => item.id)).toEqual(['entry_long', 'exit_long'])
  })
})
