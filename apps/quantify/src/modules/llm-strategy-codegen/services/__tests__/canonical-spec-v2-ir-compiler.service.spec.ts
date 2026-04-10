import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

describe('canonicalSpecV2IrCompilerService', () => {
  it('compiles canonical spec v2 into deterministic graphSnapshot and IR without reading UI state', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'ema', params: { fast: 7, slow: 21 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-long',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.graphSnapshot.status).toBe('confirmed')
    expect(result.ir.irVersion).toBe('csi.v1')
    expect(result.ir.source.specHash).toMatch(/^sha256:/)
    expect(result.semanticView).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.ir.source.specHash,
    }))
  })

  it('compiles bollinger outside-band reduce rule with okx perp market metadata', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.market).toEqual(expect.objectContaining({
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'BTCUSDT',
      timeframes: ['15m'],
    }))
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'BOLLINGER_BARS_OUTSIDE',
        params: expect.objectContaining({ bars: 3 }),
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'REDUCE_LONG' }),
          expect.objectContaining({ kind: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('compiles RSI threshold rules into RSI series and graph operators', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'entry-rsi-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'rsi.threshold_lte',
              semanticScope: 'market',
              op: 'LTE',
              value: 30,
              params: { period: 14 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'RSI',
        params: expect.objectContaining({ period: 14 }),
      }),
    ]))
    expect(result.graphSnapshot.trigger[0]?.operator).toContain('RSI(CLOSE,14)')
  })

  it('compiles MACD cross rules into MACD line and signal series', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'entry-macd-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'macd.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'MACD_LINE',
        params: expect.objectContaining({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      }),
      expect.objectContaining({
        kind: 'MACD_SIGNAL',
        params: expect.objectContaining({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      }),
    ]))
    expect(result.graphSnapshot.trigger[0]?.operator).toContain('MACD_LINE')
  })

  it('compiles grid rules into arithmetic level sets and touch predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { family: 'grid' } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-grid',
            phase: 'entry',
            sideScope: 'long',
            priority: 170,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'LTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-grid',
            phase: 'exit',
            sideScope: 'long',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'GTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.levelSets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        spacing: expect.objectContaining({ mode: 'pct', value: 1 }),
      }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TOUCH_LEVEL_DOWN' }),
      expect.objectContaining({ kind: 'TOUCH_LEVEL_UP' }),
    ]))
  })

  it('compiles short-grid rules into short entry/exit actions and long_short position mode', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { family: 'grid' } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-grid-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 170,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'GTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-grid-short',
            phase: 'exit',
            sideScope: 'short',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'grid.range_rebalance',
              semanticScope: 'market',
              op: 'LTE',
              params: { rangeMin: 60000, rangeMax: 80000, stepPct: 1, levelCount: 21 },
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.portfolio.positionMode).toBe('long_short')
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('compiles breakout and risk guards into deterministic IR', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'custom', params: { family: 'breakout' } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'entry-breakout-high',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            cooldownBars: 5,
            condition: {
              kind: 'atom',
              key: 'breakout.channel_high_break',
              semanticScope: 'market',
              op: 'CROSS_OVER',
              params: { period: 20 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'risk-take-profit',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
          {
            id: 'risk-trailing-stop',
            phase: 'risk',
            sideScope: 'both',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.trailing_stop_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
          {
            id: 'exit-time-stop',
            phase: 'exit',
            sideScope: 'long',
            priority: 90,
            condition: {
              kind: 'atom',
              key: 'risk.time_stop_bars',
              semanticScope: 'position',
              op: 'GTE',
              value: 12,
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HIGHEST_HIGH', params: expect.objectContaining({ period: 20 }) }),
      expect.objectContaining({ kind: 'POSITION_BARS_HELD' }),
    ]))
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TAKE_PROFIT_PCT', value: 5 }),
      expect.objectContaining({ kind: 'TRAILING_STOP_PCT', value: 10 }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry', cooldownBars: 5 }),
      expect.objectContaining({ phase: 'exit' }),
    ]))
  })

  it('compiles partial take-profit into rebalance reduce actions instead of a force-exit guard', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'risk-partial-take-profit',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.riskPolicy.guards.some(guard => guard.kind === 'TAKE_PROFIT_PCT')).toBe(false)
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'REDUCE_LONG' }),
          expect.objectContaining({ kind: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('compiles partial take-profit ratio into position_pct reduce quantity', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [{ kind: 'rsi', params: { period: 14 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['1h'],
        },
        rules: [
          {
            id: 'risk-partial-take-profit-ratio',
            phase: 'risk',
            sideScope: 'long',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'REDUCE_LONG', sizing: { mode: 'RATIO', value: 0.3 } }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: [expect.objectContaining({
          kind: 'REDUCE_LONG',
          quantity: { mode: 'pct_equity', value: 30 },
        })],
      }),
    ]))
  })
})
