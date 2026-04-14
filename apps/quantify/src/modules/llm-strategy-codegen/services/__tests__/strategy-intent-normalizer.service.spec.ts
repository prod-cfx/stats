import { FIRST_WAVE_FAMILIES, FIRST_WAVE_STATE_TRIGGER_ATOMS, FIRST_WAVE_TRIGGER_ATOMS, GRID_STRATEGY_FAMILY } from '../../constants/canonical-strategy-capabilities'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'

describe('strategyIntentNormalizerService', () => {
  it('registers the first-wave atom and family catalog', () => {
    expect(FIRST_WAVE_TRIGGER_ATOMS).toEqual(expect.arrayContaining([
      'price.percent_change',
      'trend.direction',
      'market.regime',
      'volatility.state',
    ]))
    expect(FIRST_WAVE_STATE_TRIGGER_ATOMS).toEqual([
      'trend.direction',
      'market.regime',
      'volatility.state',
    ])
    expect(FIRST_WAVE_FAMILIES).toEqual([
      'single-leg',
      GRID_STRATEGY_FAMILY,
      'state-gated',
    ])
  })

  it('normalizes same-intent drop-buy variants into one percent_change atom', () => {
    const service = new StrategyIntentNormalizerService()

    const first = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '3m' },
      entryRules: ['3分钟内下跌1%买入'],
      exitRules: ['15分钟内上涨2%卖出'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    const second = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '3m' },
      entryRules: ['3分钟内回调1%做多'],
      exitRules: ['15分钟内反弹2%平多'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    expect(first.normalizedIntent.triggers).toEqual(second.normalizedIntent.triggers)
  })

  it('normalizes a fixed-range grid into the grid.range_rebalance family', () => {
    const service = new StrategyIntentNormalizerService()

    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['在 60000-80000 的区间，每一格千分之5，不断低买高卖'],
      exitRules: ['持续网格卖出'],
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 8 },
    } as any)

    expect(result.normalizedIntent.families).toContain(GRID_STRATEGY_FAMILY)
    expect(result.normalizedIntent.grid).toEqual(expect.objectContaining({
      family: GRID_STRATEGY_FAMILY,
      range: { lower: 60000, upper: 80000 },
      stepPct: 0.5,
      sideMode: 'bidirectional',
    }))
  })
})
