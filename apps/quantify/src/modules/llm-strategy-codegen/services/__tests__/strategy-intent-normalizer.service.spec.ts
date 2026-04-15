import { FIRST_WAVE_FAMILIES, FIRST_WAVE_STATE_TRIGGER_ATOMS, FIRST_WAVE_TRIGGER_ATOMS, GRID_STRATEGY_FAMILY } from '../../constants/canonical-strategy-capabilities'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'

describe('strategyIntentNormalizerService', () => {
  const service = new StrategyIntentNormalizerService()

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

  it('keeps the live price-change strategy closed', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '3m' },
      entryRules: ['3分钟之内跌百分1买入'],
      exitRules: ['15分钟之内涨百分2卖出'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers.every(item => item.closureStatus === 'closed')).toBe(true)
  })

  it('keeps the live bollinger strategy closed', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', marketType: 'perp', timeframe: '15m' },
      entryRules: ['上轨做空', '下轨做多'],
      exitRules: ['回到中轨平仓'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers.every(item => item.closureStatus === 'closed')).toBe(true)
  })

  it('keeps moving-average breakout semantics open instead of dropping them', () => {
    const result = service.normalize({
      entryRules: ['价格突破一条长期均线时买入'],
      exitRules: ['跌破短期均线时卖出'],
      stateGates: { marketRegime: '震荡行情' },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'reference.period' }),
          expect.objectContaining({ slotKey: 'confirmationMode' }),
        ]),
      }),
      expect.objectContaining({
        key: 'indicator.below',
        closureStatus: 'open',
      }),
    ]))
    expect(result.normalizedIntent.stateHints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: '震荡行情',
        closureStatus: 'open',
      }),
    ]))
  })
})
