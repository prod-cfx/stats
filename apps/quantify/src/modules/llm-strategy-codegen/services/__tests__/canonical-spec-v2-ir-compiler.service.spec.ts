import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../../types/canonical-strategy-ir'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function findSeries(
  series: CanonicalStrategyIrV1['signalCatalog']['series'],
  matcher: (item: SeriesDef) => boolean,
): SeriesDef {
  const found = series.find(matcher)
  expect(found).toBeDefined()
  return found as SeriesDef
}

function findPredicate(
  predicates: CanonicalStrategyIrV1['signalCatalog']['predicates'],
  matcher: (item: PredicateDef) => boolean,
): PredicateDef {
  const found = predicates.find(matcher)
  expect(found).toBeDefined()
  return found as PredicateDef
}

describe('canonicalSpecV2IrCompilerService', () => {
  it('compiles moving-average fastPeriod and slowPeriod without falling back to defaults', () => {
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
        indicators: [{ kind: 'sma', params: { fastPeriod: 6, slowPeriod: 48 } }],
        sizing: { mode: 'RATIO', value: 0.35 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-ma-cross',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: { kind: 'atom', key: 'ma.golden_cross', semanticScope: 'market', op: 'CROSS_OVER' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.35 } }],
          },
          {
            id: 'exit-ma-cross',
            phase: 'exit',
            sideScope: 'long',
            priority: 140,
            condition: { kind: 'atom', key: 'ma.death_cross', semanticScope: 'market', op: 'CROSS_UNDER' },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 35,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'sma_6_15m', params: { period: 6 } }),
      expect.objectContaining({ id: 'sma_48_15m', params: { period: 48 } }),
    ]))
    expect(result.ir.signalCatalog.series).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ema_7_15m' }),
      expect.objectContaining({ id: 'ema_21_15m' }),
    ]))
  })

  it('compiles MACD 16/34/12 cross rules without falling back to defaults', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'macd', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }],
        sizing: { mode: 'RATIO', value: 0.35 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-macd-cross',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: { kind: 'atom', key: 'macd.golden_cross', semanticScope: 'market', op: 'CROSS_OVER' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.35 } }],
          },
          {
            id: 'exit-macd-cross',
            phase: 'exit',
            sideScope: 'long',
            priority: 140,
            condition: { kind: 'atom', key: 'macd.death_cross', semanticScope: 'market', op: 'CROSS_UNDER' },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 35,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'macd_line_16_34_12_15m', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }),
      expect.objectContaining({ id: 'macd_signal_16_34_12_15m', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } }),
    ]))
    expect(result.ir.signalCatalog.series).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'macd_line_12_26_9_15m' }),
      expect.objectContaining({ id: 'macd_signal_12_26_9_15m' }),
    ]))
  })

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

  it('preserves short_only positionMode when canonical spec only trades the short side', () => {
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
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-short',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
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

    expect(result.ir.portfolio.positionMode).toBe('short_only')
  })

  it('compiles multi-timeframe canonical specs into ordered IR market timeframes', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '3m',
        },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['3m', '15m'],
        },
        rules: [
          {
            id: 'entry-price-change-1',
            phase: 'entry',
            priority: 100,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'LTE',
              value: -0.01,
              params: { timeframe: '3m', lookbackBars: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'exit-price-change-1',
            phase: 'exit',
            priority: 90,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'position_gain_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.02,
              params: { timeframe: '15m', basis: 'entry_avg_price' },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '3m',
        positionPct: 10,
      },
    })

    expect(result.ir.market.timeframes).toEqual(['3m', '15m'])
  })

  it('normalizes position_gain_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '1h',
        },
        indicators: [],
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
            id: 'entry-position-gain',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'position_gain_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
              params: { timeframe: '1h', basis: 'entry_avg_price' },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'POSITION_PNL_PCT' && series.timeframe === '1h')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 10)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT', timeframe: '1h' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 10 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'GTE(POSITION_PNL_PCT,10)',
      }),
    ]))
  })

  it('normalizes risk.take_profit_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '1h',
        },
        indicators: [],
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
            id: 'entry-take-profit',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series => series.kind === 'POSITION_PNL_PCT')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 10)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 10 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'GTE(POSITION_PNL_PCT,10)',
      }),
    ]))
  })

  it('normalizes position_loss_pct thresholds to runtime percent units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '1h',
        },
        indicators: [],
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
            id: 'entry-stop-loss',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const pnlSeries = findSeries(result.ir.signalCatalog.series, series => series.kind === 'POSITION_PNL_PCT')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === -5)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'LTE' && item.args.includes(pnlSeries.id) && item.args.includes(thresholdSeries.id))

    expect(pnlSeries).toEqual(expect.objectContaining({ kind: 'POSITION_PNL_PCT' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: -5 }))
    expect(predicate.args).toEqual([pnlSeries.id, thresholdSeries.id])
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operator: 'LTE(POSITION_PNL_PCT,-5)',
      }),
    ]))
  })

  it('keeps price.change_pct thresholds in ratio units', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [],
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
            id: 'entry-price-change',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.01,
              params: { timeframe: '1h', lookbackBars: 1 },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    const priceChangeSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'PRICE_CHANGE_PCT' && series.timeframe === '1h')
    const thresholdSeries = findSeries(result.ir.signalCatalog.series, series =>
      series.kind === 'CONST' && series.value === 0.01)
    const predicate = findPredicate(result.ir.signalCatalog.predicates, item =>
      item.kind === 'GTE' && item.args.includes(priceChangeSeries.id) && item.args.includes(thresholdSeries.id))

    expect(priceChangeSeries).toEqual(expect.objectContaining({ kind: 'PRICE_CHANGE_PCT', timeframe: '1h' }))
    expect(thresholdSeries).toEqual(expect.objectContaining({ kind: 'CONST', value: 0.01 }))
    expect(predicate.args).toEqual([priceChangeSeries.id, thresholdSeries.id])
  })

  it('compiles generic execution-on-start entry rules into deterministic runtime predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'ORDIUSDT',
          marketType: 'spot',
          timeframe: '1h',
        },
        indicators: [],
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
            id: 'entry-on-start',
            phase: 'entry',
            priority: 200,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'execution.on_start',
              semanticScope: 'market',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-prev-close-rise',
            phase: 'exit',
            priority: 100,
            sideScope: 'long',
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.01,
              params: { timeframe: '1h', lookbackBars: 1, basis: 'prev_close' },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'ORDIUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'BAR_INDEX' }),
      expect.objectContaining({ kind: 'PRICE_CHANGE_PCT', timeframe: '1h' }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-on-start',
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_LONG' })],
      }),
    ]))
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

  it('keeps middle-close, stop-loss, and outside-band full close as distinct compiled triggers', () => {
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
            id: 'exit-middle-1',
            phase: 'exit',
            sideScope: 'both',
            priority: 140,
            condition: {
              kind: 'atom',
              key: 'bollinger.middle_revert',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
          },
          {
            id: 'risk-stop-loss',
            phase: 'risk',
            sideScope: 'both',
            priority: 120,
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
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
            actions: [{ type: 'FORCE_EXIT' }],
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

    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', value: 5 }),
    ]))
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'BOLLINGER_BARS_OUTSIDE',
        params: expect.objectContaining({ bars: 3 }),
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'CLOSE_LONG' }),
          expect.objectContaining({ kind: 'CLOSE_SHORT' }),
        ]),
      }),
    ]))
    expect(result.ir.ruleBlocks.filter(block => block.phase === 'exit')).toHaveLength(2)
  })

  it('compiles short-side bollinger middle revert without broad OR flattening', () => {
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
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-short-middle',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'bollinger.middle_revert',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_SHORT' }],
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

    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'CROSS_UNDER',
        args: ['close_15m', 'mid_band_20_2_15m'],
      }),
      expect.objectContaining({
        kind: 'OR',
        args: ['exit_short_middle_middle_over', 'exit_short_middle_middle_under'],
      }),
    ]))
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        operator: 'OR(CROSS_OVER(CLOSE,MID_BAND(CLOSE,20,2)),CROSS_UNDER(CLOSE,MID_BAND(CLOSE,20,2)))',
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'exit-short-middle',
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
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

  it('compiles rolling range-position rules into dynamic channel predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'custom', params: { atom: 'price.range_position' } }],
        sizing: { mode: 'RATIO', value: 0.25 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-range-low-zone',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'price.range_position_lte',
              semanticScope: 'market',
              op: 'LTE',
              value: 0.2,
              params: { period: 36 },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'exit-range-upper-zone',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'price.range_position_gte',
              semanticScope: 'market',
              op: 'GTE',
              value: 0.55,
              params: { period: 36 },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 25,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'HIGHEST_HIGH', params: expect.objectContaining({ period: 36 }) }),
      expect.objectContaining({ kind: 'LOWEST_LOW', params: expect.objectContaining({ period: 36 }) }),
      expect.objectContaining({
        kind: 'RANGE_POSITION_PCT',
        params: expect.objectContaining({ period: 36 }),
      }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'LTE' }),
      expect.objectContaining({ kind: 'GTE' }),
    ]))
    expect(result.graphSnapshot.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ operator: 'LTE(RANGE_POSITION_PCT(CLOSE,HIGHEST_HIGH(36),LOWEST_LOW(36)),0.2)' }),
      expect.objectContaining({ operator: 'GTE(RANGE_POSITION_PCT(CLOSE,HIGHEST_HIGH(36),LOWEST_LOW(36)),0.55)' }),
    ]))
  })

  it('compiles short-grid rules into short entry/exit actions and short_only position mode', () => {
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

    expect(result.ir.portfolio.positionMode).toBe('short_only')
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

  it('compiles state-gated canonical rules into deterministic IR predicates', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const canonicalSpec = {
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
            id: 'entry-gated-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'AND',
              children: [
                {
                  kind: 'atom',
                  key: 'bollinger.upper_break',
                  semanticScope: 'market',
                  op: 'CROSS_OVER',
                },
                {
                  kind: 'atom',
                  key: 'market.regime',
                  semanticScope: 'market',
                  op: 'EQ',
                  value: 'range',
                },
              ],
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
            metadata: {
              normalized: {
                source: 'normalized-intent',
                triggerKeys: ['bollinger.touch_upper'],
                gateKeys: ['market.regime'],
                actionKeys: ['OPEN_SHORT'],
                family: 'single-leg',
              },
            },
          },
        ],
      } satisfies CanonicalStrategySpecV2

    const result = compiler.compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'MARKET_REGIME' }),
      expect.objectContaining({ kind: 'CONST', value: 'range' }),
    ]))
    expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'EQ' }),
      expect.objectContaining({ kind: 'AND' }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
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

  it('compiles short breakout and short-side trade management into deterministic IR', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
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
            id: 'entry-breakout-low',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            cooldownBars: 5,
            condition: {
              kind: 'atom',
              key: 'breakout.channel_low_break',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
              params: { period: 20 },
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'risk-take-profit-short',
            phase: 'risk',
            sideScope: 'short',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'risk.take_profit_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.05,
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
          {
            id: 'risk-trailing-stop-short',
            phase: 'risk',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'risk.trailing_stop_pct',
              semanticScope: 'position',
              op: 'GTE',
              value: 0.1,
            },
            actions: [{ type: 'CLOSE_SHORT' }],
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

    expect(result.ir.portfolio.positionMode).toBe('short_only')
    expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TRAILING_STOP_PCT', value: 10 }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        cooldownBars: 5,
        actions: [expect.objectContaining({ kind: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ kind: 'CLOSE_SHORT' })],
      }),
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
