import type { StrategyIR } from '../../types/strategy-ir'
import { StrategyIrCanonicalAdapterService } from '../strategy-ir-canonical-adapter.service'

describe('strategyIrCanonicalAdapterService', () => {
  const service = new StrategyIrCanonicalAdapterService()

  it('adapts StrategyIR back into canonical spec v2 during migration', () => {
    const strategyIr: StrategyIR = {
      version: 'strategy-ir.v1',
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      intent: {
        kind: 'grid.range_rebalance',
        trigger: {
          range: { lower: 60000, upper: 80000 },
          stepPct: 0.5,
          sideMode: 'bidirectional',
          recycle: true,
        },
        sizing: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_short',
        },
        actions: ['open_long', 'close_long', 'open_short', 'close_short'],
        risk: [
          {
            kind: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price' },
          },
        ],
      },
    }

    const canonicalSpec = service.adapt(strategyIr)

    expect(canonicalSpec).toEqual(expect.objectContaining({
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '15m',
      },
      sizing: {
        mode: 'RATIO',
        value: 0.1,
      },
      indicators: expect.arrayContaining([
        expect.objectContaining({
          kind: 'custom',
          params: { family: 'grid' },
        }),
      ]),
      metadata: {
        strategyIr: {
          version: 'strategy-ir.v1',
          intentKind: 'grid.range_rebalance',
        },
      },
    }))
    expect(canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            timeframe: '15m',
          }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
    ]))
  })
})
