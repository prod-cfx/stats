import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

describe('canonicalSpecBuilderService', () => {
  it('normalizes a bollinger breakout checklist into a canonical spec', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        'K线收盘后确认突破布林带上轨时做空',
        'K线收盘后确认突破布林带下轨时做多',
      ],
      exitRules: [
        '价格回到布林带中轨(MA20)时平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时考虑提前止损或减仓',
      },
    })

    expect(spec.market.exchange).toBe('okx')
    expect(spec.market.symbol).toBe('BTCUSDT')
    expect(spec.market.timeframe).toBe('15m')
    expect(spec.indicators).toContainEqual({
      kind: 'bollingerBands',
      params: { period: 20, stdDev: 2 },
    })
    expect(spec.entries.map(rule => rule.action)).toEqual(['OPEN_SHORT', 'OPEN_LONG'])
    expect(spec.exits[0]?.trigger).toContain('中轨')
    expect(spec.riskRules.map(rule => rule.effect)).toEqual(['FORCE_STOP', 'REDUCE_POSITION'])
    expect(spec.sizing).toEqual({ mode: 'RATIO', value: 0.1 })
    expect(spec.executionPolicy).toEqual({
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'NEXT_BAR_OPEN',
    })
  })

  it('detects non-sma indicators from checklist text', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['RSI < 30 时做多，MACD 金叉辅助确认'],
      exitRules: ['ATR 止损，EMA 趋势反转时平仓'],
    })

    expect(spec.indicators).toEqual(expect.arrayContaining([
      { kind: 'rsi', params: { period: 14 } },
      { kind: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      { kind: 'atr', params: { period: 14 } },
      { kind: 'ema', params: { period: 20 } },
    ]))
  })
})
