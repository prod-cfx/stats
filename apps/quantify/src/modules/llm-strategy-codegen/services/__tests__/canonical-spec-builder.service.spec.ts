import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

describe('canonicalSpecBuilderService', () => {
  it('builds independent Bollinger rules for upper-short, lower-long, middle-close, and outside-band full close', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前全平',
        positionPct: 10,
      },
    })

    expect(spec.version).toBe(2)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'both',
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'CLOSE_LONG' }),
          expect.objectContaining({ type: 'CLOSE_SHORT' }),
        ]),
      }),
      expect.objectContaining({
        phase: 'risk',
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))

    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
    expect(entryRules).toHaveLength(2)
  })

  it('builds outside-band reduce rules when earlyStop asks to reduce exposure', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前减仓',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'bollinger.bars_outside',
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('emits empty v2 rules when checklist has no recognizable trigger patterns', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['基于盘口情绪择机入场'],
      exitRules: ['根据主观判断离场'],
    })

    expect(spec).toEqual(expect.objectContaining({
      version: 2,
      rules: [],
      indicators: [],
      sizing: null,
    }))
  })

  it('does not inject implicit market/sizing/sma defaults when checklist is missing them', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['价格收盘确认突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    expect(spec.market).toEqual({
      exchange: 'binance',
      symbol: null,
      marketType: 'spot',
      timeframe: null,
    })
    expect(spec.indicators).toEqual([])
    expect(spec.sizing).toBeNull()
    expect(spec.dataRequirements).toEqual({ requiredTimeframes: [] })
  })

  it('parses moving-average short entry and short exit without forcing golden-entry/death-exit defaults', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线下穿长均线（死叉）时做空'],
      exitRules: ['短均线上穿长均线（金叉）时平空'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: { period: 20 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('uses checklist riskRules.exchange as canonical market exchange when provided', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线上穿长均线时做多'],
      exitRules: ['短均线下穿长均线时平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    })
  })

  it('builds RSI threshold entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['RSI 14 高于 70 时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'rsi',
      params: { period: 14 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_lte', value: 30 }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_gte', value: 70 }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds MACD cross entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['MACD 金叉时做多'],
      exitRules: ['MACD 死叉时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'macd',
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.golden_cross' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.death_cross' }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入'],
      exitRules: ['价格触达上方网格卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'custom',
      params: { family: 'grid' },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
    ]))
  })

  it('builds short-grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空'],
      exitRules: ['价格回落触达下方网格买回平空'],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds bidirectional grid rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入',
        '在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空',
      ],
      exitRules: [
        '价格触达上方网格卖出',
        '价格回落触达下方网格买回平空',
      ],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules.filter(rule => rule.phase === 'entry')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'OPEN_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'OPEN_SHORT' })] }),
    ]))
    expect(spec.rules.filter(rule => rule.phase === 'exit')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'CLOSE_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })] }),
    ]))
  })

  it('builds breakout, take-profit, trailing-stop and time-stop rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破前20根K线最高价时做多，冷却 5 根K线'],
      exitRules: ['收益率达到 5% 止盈', '移动止损 10%', '持仓超过 12 根K线平仓'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        cooldownBars: 5,
        condition: expect.objectContaining({
          key: 'breakout.channel_high_break',
          params: expect.objectContaining({ period: 20 }),
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.trailing_stop_pct',
          value: 0.1,
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'risk.time_stop_bars',
          value: 12,
        }),
      }),
    ]))
  })

  it('builds partial take-profit rules into canonical spec v2 using reduce actions', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('builds partial take-profit rules with explicit reduce ratio', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓 30% 止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'both',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: 'REDUCE_LONG',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
          expect.objectContaining({
            type: 'REDUCE_SHORT',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
        ]),
      }),
    ]))
  })
})
