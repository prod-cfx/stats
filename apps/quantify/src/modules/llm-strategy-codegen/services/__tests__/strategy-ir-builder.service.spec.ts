import type { AtomicIntentResolution } from '../../types/strategy-ambiguity'
import type { StrategyExecutionContext } from '../../types/strategy-execution-context'
import { StrategyIrBuilderService } from '../strategy-ir-builder.service'

describe('strategyIrBuilderService', () => {
  const service = new StrategyIrBuilderService()

  it('builds StrategyIR from execution context + resolved grid atomic intent', () => {
    const context: StrategyExecutionContext = {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    }
    const resolution: AtomicIntentResolution = {
      atomicIntent: {
        triggers: [
          {
            kind: 'grid_touch',
            params: {
              range: { lower: 60000, upper: 80000 },
              stepPct: 0.5,
              sideMode: 'bidirectional',
              recycle: true,
            },
          },
        ],
        actions: [
          { kind: 'open_long' },
          { kind: 'close_long' },
          { kind: 'open_short' },
          { kind: 'close_short' },
        ],
        sizing: {
          kind: 'position_sizing',
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_short',
        },
        risk: [
          {
            kind: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price' },
          },
        ],
        relations: [],
      },
      ambiguities: [],
    }

    const strategyIr = service.build({
      context,
      resolution,
    })

    expect(strategyIr).toEqual({
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
    })
  })
})
