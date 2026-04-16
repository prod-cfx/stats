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

  it('normalizes moving-average crossover rules into stable sma triggers and long-only position semantics', () => {
    const service = new StrategyIntentNormalizerService()

    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1h' },
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.families).toContain('single-leg')
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'sma' },
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: { indicator: 'sma' },
      }),
    ]))
    expect(result.normalizedIntent.actions).toEqual([
      { key: 'open_long' },
      { key: 'close_long' },
    ])
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
    expect(result.normalizedIntent.unresolved).toEqual([])
  })

  it('preserves explicit touch-plus-close bollinger semantics during normalization', () => {
    const service = new StrategyIntentNormalizerService()

    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['触及布林带上轨后收盘确认做空', '触及布林带下轨后收盘确认做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.families).toContain('single-leg')
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: { band: 'upper' },
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
      }),
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: { band: 'lower' },
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
        params: { band: 'middle' },
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
      }),
    ]))
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_short',
    })
    expect(result.normalizedIntent.unresolved).toEqual([])
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
    expect(result.normalizedIntent.actions).toEqual([
      { key: 'open_long' },
      { key: 'close_long' },
      { key: 'open_short' },
      { key: 'close_short' },
    ])
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_short',
    })
    expect(result.normalizedIntent.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price' },
      }),
      expect.objectContaining({
        key: 'risk.take_profit_pct',
        params: { valuePct: 8, basis: 'entry_avg_price' },
      }),
    ]))
  })

  it('keeps vague grid semantics as an open grid atom instead of dropping them into unresolved fallback', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp' },
      entryRules: ['帮我做一个网格策略，在一个区间内自动买卖，行情突破区间就停掉'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'grid.range.lower' }),
          expect.objectContaining({ slotKey: 'grid.range.upper' }),
          expect.objectContaining({ slotKey: 'grid.stepPct' }),
        ]),
      }),
    ]))
    expect(result.normalizedIntent.unresolved).toEqual([])
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

  it('falls back to an open trigger slot instead of dropping unsupported breakout concepts', () => {
    const result = service.normalize({
      entryRules: ['价格突破关键位置后回踩确认支撑有效再进场'],
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'unknown_trigger_definition' }),
          expect.objectContaining({ slotKey: 'pullback.confirmation' }),
        ]),
      }),
    ]))
  })
})
